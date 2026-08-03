"use server";

import { prisma } from "@/lib/prisma";
import { getVerticalByKey } from "@/lib/verticals";
import { buildVerticalReport } from "@/lib/vertical-diagnostic";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect, notFound } from "next/navigation";

/**
 * Comercialização modular por vertical (plano estratégico, seção
 * "Ferramentas Oficiais Arca BTO" — Arca Checkup): um diagnóstico escopado a
 * UMA vertical (1 a N áreas, ver lib/verticals.ts), em vez das 12 inteiras.
 * Reaproveita a wizard do questionário completo — a página já é genérica por
 * areaKey, só o roteamento de "próxima área"/conclusão muda por scope (ver
 * saveAreaAnswers em app/actions.ts). Qualquer empresa pode ter 0, 1 ou
 * quantas verticais contratadas fizerem sentido — nada aqui assume que só
 * existe um módulo no sistema.
 */
export async function startVerticalDiagnostic(companyId: string, verticalKey: string) {
  const session = await getSession();
  if (session?.role === "cliente") notFound(); // mesma regra de createDiagnostic: só a Arca inicia
  assertCompanyAccess(session, companyId);

  const vertical = getVerticalByKey(verticalKey);
  if (!vertical) notFound();

  const diagnostic = await prisma.diagnostic.create({
    data: { companyId, scope: verticalKey },
  });

  redirect(`/diagnostico/${diagnostic.id}/questionario/${vertical.areaKeys[0]}`);
}

export async function approveVerticalActionPlan(diagnosticId: string) {
  const session = await getSession();
  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { answers: true, tasks: true },
  });
  if (!diagnostic) notFound();
  assertCompanyAccess(session, diagnostic.companyId);

  const vertical = getVerticalByKey(diagnostic.scope);
  if (!vertical) notFound();

  if (diagnostic.tasks.length === 0) {
    const report = buildVerticalReport(
      vertical,
      diagnostic.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
    );

    // Um único épico (o nome da própria vertical) — cobre todas as áreas
    // dela, não um épico por área.
    const epic = await prisma.epic.create({ data: { diagnosticId, name: vertical.name } });

    await prisma.task.createMany({
      data: report.actionItems.map((item, index) => ({
        diagnosticId,
        areaKey: item.areaKey,
        areaName: item.areaName,
        title: item.action,
        priority: item.priority,
        timeframe: item.timeframe,
        status: "todo",
        position: index,
        epicId: epic.id,
      })),
    });

    await prisma.diagnostic.update({ where: { id: diagnosticId }, data: { status: "em_execucao" } });
  }

  // O Kanban (/diagnostico/[id]/projeto) já é genérico por diagnosticId —
  // funciona sem nenhuma mudança pra um diagnóstico de vertical.
  redirect(`/diagnostico/${diagnosticId}/projeto`);
}
