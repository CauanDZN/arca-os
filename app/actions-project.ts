"use server";

import { prisma } from "@/lib/prisma";
import { buildReport, type ActionItem } from "@/lib/scoring";
import { redirect } from "next/navigation";

export async function approveActionPlan(diagnosticId: string) {
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
      })),
    });

    await prisma.diagnostic.update({
      where: { id: diagnosticId },
      data: { status: "em_execucao" },
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
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (task) {
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextIndex =
      direction === "forward"
        ? Math.min(currentIndex + 1, STATUS_ORDER.length - 1)
        : Math.max(currentIndex - 1, 0);
    await prisma.task.update({
      where: { id: taskId },
      data: { status: STATUS_ORDER[nextIndex] },
    });
  }
  redirect(`/diagnostico/${diagnosticId}/projeto`);
}
