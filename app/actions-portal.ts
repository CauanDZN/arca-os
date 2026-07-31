"use server";

import { prisma } from "@/lib/prisma";
import { decisionSchema, messageSchema } from "@/lib/validation";
import { buildMonthlyReport, currentPeriod } from "@/lib/monthly-report";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect } from "next/navigation";

export async function addDecision(companyId: string, formData: FormData) {
  assertCompanyAccess(await getSession(), companyId);

  const session = await getSession();
  const { title, summary, decidedAt, decidedBy } = decisionSchema.parse({
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    decidedAt: String(formData.get("decidedAt") ?? ""),
    decidedBy: String(formData.get("decidedBy") ?? ""),
  });

  await prisma.decision.create({
    data: {
      companyId,
      title,
      summary,
      decidedAt,
      decidedBy: decidedBy || session?.name || "",
    },
  });

  redirect(`/portal/${companyId}#decisoes`);
}

export async function sendMessage(companyId: string, formData: FormData) {
  assertCompanyAccess(await getSession(), companyId);

  const session = await getSession();
  const { body } = messageSchema.parse({
    body: String(formData.get("body") ?? ""),
  });

  await prisma.message.create({
    data: {
      companyId,
      body,
      authorName: session?.name ?? "",
      authorRole: session?.role ?? "cliente",
    },
  });

  redirect(`/portal/${companyId}#comunicacao`);
}

// Gera (ou atualiza) o Relatório Mensal da empresa para o mês corrente — usado
// pelo botão do Portal e pelo cron /api/cron/mensal, que chama o mesmo cálculo.
export async function generateMonthlyReport(companyId: string) {
  assertCompanyAccess(await getSession(), companyId);

  const period = currentPeriod();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      diagnostics: {
        orderBy: { createdAt: "desc" },
        include: { answers: true, tasks: true },
      },
    },
  });
  if (!company) redirect(`/portal/${companyId}`);

  const latest = company.diagnostics.find((d) => d.answers.length > 0);
  if (!latest) redirect(`/portal/${companyId}`);

  const [decisionsCount, kpiCount] = await Promise.all([
    prisma.decision.count({ where: { companyId } }),
    prisma.kpiEntry.count({ where: { companyId } }),
  ]);

  const data = buildMonthlyReport(
    {
      period,
      answers: latest.answers.map((a) => ({
        areaKey: a.areaKey,
        questionId: a.questionId,
        score: a.score,
      })),
      tasks: latest.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        areaName: t.areaName,
        status: t.status,
        dueDate: t.dueDate,
        responsible: t.responsible,
      })),
      decisionsCount,
      kpiCount,
    },
    new Date()
  );

  if (data) {
    await prisma.monthlyReport.upsert({
      where: { companyId_period: { companyId, period } },
      update: {
        overallAverage: data.overallAverage,
        maturityLevel: data.maturityLevel,
        maturityLabel: data.maturityLabel,
        areaAverages: JSON.stringify(data.areaAverages),
        taskStats: JSON.stringify(data.taskStats),
        pendingCount: data.pendingCount,
        decisionsCount: data.decisionsCount,
        kpiCount: data.kpiCount,
      },
      create: {
        companyId,
        period,
        overallAverage: data.overallAverage,
        maturityLevel: data.maturityLevel,
        maturityLabel: data.maturityLabel,
        areaAverages: JSON.stringify(data.areaAverages),
        taskStats: JSON.stringify(data.taskStats),
        pendingCount: data.pendingCount,
        decisionsCount: data.decisionsCount,
        kpiCount: data.kpiCount,
      },
    });
  }

  redirect(`/portal/${companyId}#comite`);
}
