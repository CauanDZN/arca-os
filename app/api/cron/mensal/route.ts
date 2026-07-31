import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMonthlyReport, currentPeriod } from "@/lib/monthly-report";

// Rota do cron do Vercel (cron.json): no dia 1º de cada mês, gera/atualiza o
// Relatório Mensal (scorecard do Comitê de Gestão) de todas as empresas com
// diagnóstico respondido. Pode ser chamada manualmente com o header
// `Authorization: Bearer $CRON_SECRET`.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const period = currentPeriod();

  const companies = await prisma.company.findMany({
    include: {
      diagnostics: {
        orderBy: { createdAt: "desc" },
        include: { answers: true, tasks: true },
      },
    },
  });

  let generated = 0;

  for (const company of companies) {
    const latest = company.diagnostics.find((d) => d.answers.length > 0);
    if (!latest) continue;

    const [decisionsCount, kpiCount] = await Promise.all([
      prisma.decision.count({ where: { companyId: company.id } }),
      prisma.kpiEntry.count({ where: { companyId: company.id } }),
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
    if (!data) continue;

    await prisma.monthlyReport.upsert({
      where: { companyId_period: { companyId: company.id, period } },
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
        companyId: company.id,
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
    generated += 1;
  }

  return NextResponse.json({ ok: true, period, generated });
}
