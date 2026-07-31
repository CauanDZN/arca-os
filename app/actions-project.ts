"use server";

import { prisma } from "@/lib/prisma";
import { buildReport, type ActionItem } from "@/lib/scoring";
import { taskDetailsSchema, sprintSchema, epicSchema } from "@/lib/validation";
import { generateSprintReport, type AiNarrative } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { fireOutboundWebhook } from "@/lib/outbound-webhook";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

const SPRINT_PERIOD_DAYS = 30;

async function assertDiagnosticAccess(diagnosticId: string): Promise<{ companyId: string }> {
  const session = await getSession();
  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    select: { companyId: true },
  });
  if (!diagnostic) notFound();
  assertCompanyAccess(session, diagnostic.companyId);
  return diagnostic;
}

export async function approveActionPlan(diagnosticId: string) {
  const { companyId } = await assertDiagnosticAccess(diagnosticId);

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { answers: true, tasks: true },
  });
  if (!diagnostic) throw new Error("Diagnóstico não encontrado");

  if (diagnostic.tasks.length === 0) {
    const report = buildReport(
      diagnostic.answers.map((a) => ({
        areaKey: a.areaKey,
        questionId: a.questionId,
        score: a.score,
      }))
    );

    const allItems: ActionItem[] = [
      ...report.actionPlan.days30,
      ...report.actionPlan.days90,
      ...report.actionPlan.months12,
    ];

    // One épico per area touched by the plan — matches the "Épico 1: Financeiro,
    // Épico 2: Comercial..." backlog structure from the pitch, without requiring
    // the user to set anything up by hand.
    const areaNameByKey = new Map(allItems.map((i) => [i.areaKey, i.areaName]));
    const epicByArea = new Map<string, string>();
    for (const [areaKey, areaName] of areaNameByKey) {
      const epic = await prisma.epic.create({ data: { diagnosticId, name: areaName } });
      epicByArea.set(areaKey, epic.id);
    }

    const narrative: AiNarrative | null = diagnostic.aiNarrative
      ? JSON.parse(diagnostic.aiNarrative)
      : null;
    const causaRaizByArea = new Map(
      (narrative?.areaInsights ?? []).map((i) => [i.areaKey, i.causaRaiz])
    );

    await prisma.task.createMany({
      data: allItems.map((item, index) => ({
        diagnosticId,
        areaKey: item.areaKey,
        areaName: item.areaName,
        title: item.action,
        priority: item.priority,
        timeframe: item.timeframe,
        status: "todo",
        position: index,
        epicId: epicByArea.get(item.areaKey),
        rootCause: causaRaizByArea.get(item.areaKey) ?? "",
      })),
    });

    await prisma.diagnostic.update({
      where: { id: diagnosticId },
      data: { status: "em_execucao" },
    });

    await fireOutboundWebhook(companyId, "plan.approved", {
      diagnosticId,
      taskCount: allItems.length,
    });
  }

  redirect(`/diagnostico/${diagnosticId}/projeto`);
}

const STATUS_ORDER = ["todo", "doing", "done"];

export async function moveTask(
  diagnosticId: string,
  taskId: string,
  direction: "forward" | "backward"
) {
  const { companyId } = await assertDiagnosticAccess(diagnosticId);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (task) {
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextIndex =
      direction === "forward"
        ? Math.min(currentIndex + 1, STATUS_ORDER.length - 1)
        : Math.max(currentIndex - 1, 0);
    const nextStatus = STATUS_ORDER[nextIndex];

    if (nextStatus !== task.status) {
      await prisma.$transaction([
        prisma.task.update({ where: { id: taskId }, data: { status: nextStatus } }),
        prisma.taskEvent.create({
          data: { taskId, fromStatus: task.status, toStatus: nextStatus },
        }),
      ]);
      await fireOutboundWebhook(companyId, "task.status_changed", {
        taskId,
        title: task.title,
        fromStatus: task.status,
        toStatus: nextStatus,
      });
    }
  }
  redirect(`/diagnostico/${diagnosticId}/projeto`);
}

const VALID_STATUSES = new Set(STATUS_ORDER);

// Called from the drag-and-drop Kanban board (a Client Component), so unlike
// the other actions here it must NOT redirect — that would force a full page
// transition on every drop and kill the drag animation. revalidatePath is
// enough to refresh the server-rendered data the client already reflects
// optimistically.
export async function reorderTasks(
  diagnosticId: string,
  movedTaskId: string,
  toStatus: string,
  orderedIdsInToStatus: string[]
) {
  const { companyId } = await assertDiagnosticAccess(diagnosticId);
  if (!VALID_STATUSES.has(toStatus)) throw new Error("Status inválido");

  const movedTask = await prisma.task.findUnique({ where: { id: movedTaskId } });
  if (!movedTask || movedTask.diagnosticId !== diagnosticId) return;

  const fromStatus = movedTask.status;

  await prisma.$transaction([
    ...orderedIdsInToStatus.map((taskId, position) =>
      prisma.task.update({
        where: { id: taskId },
        data: {
          position,
          ...(taskId === movedTaskId ? { status: toStatus } : {}),
        },
      })
    ),
    ...(fromStatus !== toStatus
      ? [prisma.taskEvent.create({ data: { taskId: movedTaskId, fromStatus, toStatus } })]
      : []),
  ]);

  if (fromStatus !== toStatus) {
    await fireOutboundWebhook(companyId, "task.status_changed", {
      taskId: movedTaskId,
      title: movedTask.title,
      fromStatus,
      toStatus,
    });
  }

  revalidatePath(`/diagnostico/${diagnosticId}/projeto`);
}

export async function updateTaskDetails(
  diagnosticId: string,
  taskId: string,
  formData: FormData
) {
  await assertDiagnosticAccess(diagnosticId);

  const fields = taskDetailsSchema.parse({
    responsible: String(formData.get("responsible") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    sprintId: String(formData.get("sprintId") ?? ""),
    epicId: String(formData.get("epicId") ?? ""),
    successIndicator: String(formData.get("successIndicator") ?? ""),
    dependencies: String(formData.get("dependencies") ?? ""),
    completionEvidence: String(formData.get("completionEvidence") ?? ""),
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      responsible: fields.responsible,
      dueDate: fields.dueDate,
      sprintId: fields.sprintId,
      epicId: fields.epicId,
      successIndicator: fields.successIndicator,
      dependencies: fields.dependencies,
      completionEvidence: fields.completionEvidence,
    },
  });

  redirect(`/diagnostico/${diagnosticId}/projeto`);
}

export async function createSprint(diagnosticId: string, formData: FormData) {
  await assertDiagnosticAccess(diagnosticId);

  const fields = sprintSchema.parse({
    name: String(formData.get("name") ?? ""),
    goal: String(formData.get("goal") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  });

  await prisma.sprint.create({ data: { diagnosticId, ...fields } });

  redirect(`/diagnostico/${diagnosticId}/projeto`);
}

export async function deleteSprint(diagnosticId: string, sprintId: string) {
  await assertDiagnosticAccess(diagnosticId);

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (sprint && sprint.diagnosticId === diagnosticId) {
    await prisma.sprint.delete({ where: { id: sprintId } });
  }
  redirect(`/diagnostico/${diagnosticId}/projeto`);
}

export async function createEpic(diagnosticId: string, formData: FormData) {
  await assertDiagnosticAccess(diagnosticId);

  const fields = epicSchema.parse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  await prisma.epic.create({ data: { diagnosticId, ...fields } });

  redirect(`/diagnostico/${diagnosticId}/projeto`);
}

export async function deleteEpic(diagnosticId: string, epicId: string) {
  await assertDiagnosticAccess(diagnosticId);

  const epic = await prisma.epic.findUnique({ where: { id: epicId } });
  if (epic && epic.diagnosticId === diagnosticId) {
    await prisma.epic.delete({ where: { id: epicId } });
  }
  redirect(`/diagnostico/${diagnosticId}/projeto`);
}

export async function generateSprintReportAction(diagnosticId: string) {
  await assertDiagnosticAccess(diagnosticId);

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { company: true },
  });
  if (!diagnostic) throw new Error("Diagnóstico não encontrado");

  const since = new Date(Date.now() - SPRINT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const events = await prisma.taskEvent.findMany({
    where: { task: { diagnosticId }, createdAt: { gte: since } },
    include: { task: true },
    orderBy: { createdAt: "asc" },
  });

  const sprintReportContent =
    events.length > 0
      ? await generateSprintReport(
          diagnostic.company.name,
          events.map((e) => ({
            taskTitle: e.task.title,
            areaName: e.task.areaName,
            fromStatus: e.fromStatus,
            toStatus: e.toStatus,
            createdAt: e.createdAt,
          })),
          SPRINT_PERIOD_DAYS
        )
      : null;

  await prisma.diagnostic.update({
    where: { id: diagnosticId },
    data: { sprintReportContent, sprintReportUpdatedAt: new Date() },
  });

  redirect(`/diagnostico/${diagnosticId}/projeto#relatorio-sprint`);
}
