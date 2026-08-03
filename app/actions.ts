"use server";

import { prisma } from "@/lib/prisma";
import { AREAS, getAreaIndex } from "@/lib/areas";
import { getVerticalByKey } from "@/lib/verticals";
import { buildReport } from "@/lib/scoring";
import { generateAiNarrative, generateMaturityEvolution, type AiNarrative } from "@/lib/ai";
import { fireOutboundWebhook } from "@/lib/outbound-webhook";
import { answerFieldsSchema, narrativeEditSchema, narrativeAreaInsightSchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createDiagnostic(formData: FormData) {
  const session = await getSession();
  // creating a brand-new company/diagnostic is an Arca-side action — a
  // cliente only ever operates within their own already-existing company.
  if (session?.role === "cliente") notFound();

  const objectives = formData.getAll("objectives").map(String);

  const company = await prisma.company.create({
    data: {
      name: String(formData.get("name") ?? ""),
      segment: String(formData.get("segment") ?? ""),
      marketAge: String(formData.get("marketAge") ?? ""),
      employees: String(formData.get("employees") ?? ""),
      avgRevenue: String(formData.get("avgRevenue") ?? ""),
      margin: String(formData.get("margin") ?? ""),
      activeClients: String(formData.get("activeClients") ?? ""),
      productsServices: String(formData.get("productsServices") ?? ""),
      cities: String(formData.get("cities") ?? ""),
      painPoints: String(formData.get("painPoints") ?? ""),
      objectives: JSON.stringify(objectives),
    },
  });

  const diagnostic = await prisma.diagnostic.create({
    data: { companyId: company.id },
  });

  redirect(`/diagnostico/${diagnostic.id}/questionario/${AREAS[0].key}`);
}

export async function saveAreaAnswers(
  diagnosticId: string,
  areaKey: string,
  formData: FormData
) {
  const session = await getSession();
  const owning = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    select: { companyId: true, scope: true },
  });
  if (!owning) notFound();
  assertCompanyAccess(session, owning.companyId);

  const area = AREAS.find((a) => a.key === areaKey);
  if (!area) throw new Error("Área inválida");

  for (const question of area.questions) {
    const raw = formData.get(question.id);
    const fields = answerFieldsSchema.parse({
      score: raw !== null ? Number(raw) : 0,
      evidence: String(formData.get(`${question.id}__evidence`) ?? ""),
      responsible: String(formData.get(`${question.id}__responsible`) ?? ""),
      impact: String(formData.get(`${question.id}__impact`) ?? "Médio"),
      urgency: String(formData.get(`${question.id}__urgency`) ?? "Média"),
      risk: String(formData.get(`${question.id}__risk`) ?? "Operacional"),
    });

    await prisma.answer.upsert({
      where: {
        diagnosticId_areaKey_questionId: {
          diagnosticId,
          areaKey,
          questionId: question.id,
        },
      },
      update: fields,
      create: { diagnosticId, areaKey, questionId: question.id, ...fields },
    });
  }

  if (owning.scope !== "completo") {
    // Diagnóstico de módulo/vertical (Arca Checkup por vertical): navega
    // pelas áreas DA VERTICAL (1 a N, ver lib/verticals.ts), não pela lista
    // global de 12 — uma vertical como Comercial cobre 3 áreas em sequência
    // antes de concluir; Financeiro cobre só 1.
    const vertical = getVerticalByKey(owning.scope);
    if (!vertical) throw new Error("Vertical inválida");

    const posInVertical = vertical.areaKeys.indexOf(areaKey);
    const nextAreaKey = vertical.areaKeys[posInVertical + 1];

    if (nextAreaKey) {
      redirect(`/diagnostico/${diagnosticId}/questionario/${nextAreaKey}`);
    }

    await prisma.diagnostic.update({ where: { id: diagnosticId }, data: { status: "concluido" } });
    redirect(`/empresas/${owning.companyId}/modulo/${vertical.key}/relatorio/${diagnosticId}`);
  }

  const currentIndex = getAreaIndex(areaKey);
  const nextArea = AREAS[currentIndex + 1];

  if (nextArea) {
    redirect(`/diagnostico/${diagnosticId}/questionario/${nextArea.key}`);
  } else {
    // The last area completes the diagnostic. Saving is instant and never
    // blocks on AI — the consultive narrative (and the maturity evolution
    // comparison) are generated on demand from the report page instead, so a
    // slow/failing Gemini call can't strand the user on a spinning button or
    // leave them unable to see their own saved answers.
    await prisma.diagnostic.update({
      where: { id: diagnosticId },
      data: { status: "concluido" },
    });

    const diagnostic = await prisma.diagnostic.findUnique({
      where: { id: diagnosticId },
      include: { company: true, answers: true },
    });

    if (diagnostic) {
      const report = buildReport(
        diagnostic.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
      );
      await fireOutboundWebhook(diagnostic.companyId, "diagnostic.completed", {
        diagnosticId,
        companyName: diagnostic.company.name,
        overallAverage: report.overallAverage,
        overallStatus: report.overallStatus,
      });
    }

    redirect(`/diagnostico/${diagnosticId}/relatorio`);
  }
}

export async function generateNarrativeAction(diagnosticId: string) {
  const session = await getSession();
  const owning = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    select: { companyId: true },
  });
  if (!owning) notFound();
  assertCompanyAccess(session, owning.companyId);

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { company: true, answers: true },
  });
  if (!diagnostic) notFound();

  const report = buildReport(
    diagnostic.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
  );

  const narrative = await generateAiNarrative(
    {
      name: diagnostic.company.name,
      segment: diagnostic.company.segment,
      painPoints: diagnostic.company.painPoints,
      objectives: JSON.parse(diagnostic.company.objectives || "[]"),
    },
    report
  );
  if (narrative) {
    await prisma.diagnostic.update({
      where: { id: diagnosticId },
      data: { aiNarrative: JSON.stringify(narrative) },
    });
  }

  // Generated here, on demand — the comparison is between two now-immutable
  // diagnostics, so re-running it later would never produce a different answer.
  const previousDiagnostic = await prisma.diagnostic.findFirst({
    where: {
      companyId: diagnostic.companyId,
      id: { not: diagnosticId },
      status: { in: ["concluido", "em_execucao"] },
    },
    orderBy: { createdAt: "desc" },
    include: { answers: true },
  });
  if (previousDiagnostic) {
    const previousReport = buildReport(
      previousDiagnostic.answers.map((a) => ({
        areaKey: a.areaKey,
        questionId: a.questionId,
        score: a.score,
      }))
    );
    const evolutionNarrative = await generateMaturityEvolution(
      diagnostic.company.name,
      { date: previousDiagnostic.createdAt, report: previousReport },
      { date: diagnostic.createdAt, report }
    );
    if (evolutionNarrative) {
      await prisma.diagnostic.update({
        where: { id: diagnosticId },
        data: { evolutionNarrative },
      });
    }
  }

  revalidatePath(`/diagnostico/${diagnosticId}/relatorio`);
  redirect(`/diagnostico/${diagnosticId}/relatorio#sumario`);
}

// Passo de "validação consultiva": o consultor lê a narrativa gerada por IA e
// pode ajustar o sumário e a causa raiz/recomendação por área antes de
// aprovar o plano — approveActionPlan copia causaRaiz pro rootCause de cada
// tarefa criada, então uma edição aqui muda o que de fato vira o plano.
export async function updateNarrativeAction(diagnosticId: string, formData: FormData) {
  const session = await getSession();
  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    select: { companyId: true, aiNarrative: true },
  });
  if (!diagnostic) notFound();
  assertCompanyAccess(session, diagnostic.companyId);
  if (!diagnostic.aiNarrative) redirect(`/diagnostico/${diagnosticId}/relatorio`);

  const summaryResult = narrativeEditSchema.safeParse({
    executiveSummary: formData.get("executiveSummary"),
  });
  if (!summaryResult.success) redirect(`/diagnostico/${diagnosticId}/relatorio?error=narrativa`);

  const areaKeys = formData.getAll("areaKey").map(String);
  const causaRaizes = formData.getAll("causaRaiz").map(String);
  const recomendacoes = formData.getAll("recomendacao").map(String);

  const areaInsights = areaKeys
    .map((areaKey, i) =>
      narrativeAreaInsightSchema.safeParse({
        areaKey,
        causaRaiz: causaRaizes[i],
        recomendacao: recomendacoes[i],
      })
    )
    .filter((r) => r.success)
    .map((r) => r.data);

  const narrative: AiNarrative = {
    executiveSummary: summaryResult.data.executiveSummary,
    areaInsights,
  };
  await prisma.diagnostic.update({
    where: { id: diagnosticId },
    data: { aiNarrative: JSON.stringify(narrative) },
  });

  // Sem isso, o Router Cache do Next reaproveita o RSC payload da mesma rota
  // que o consultor acabou de visitar e o redirect volta mostrando o texto
  // antigo até um refresh manual.
  revalidatePath(`/diagnostico/${diagnosticId}/relatorio`);
  redirect(`/diagnostico/${diagnosticId}/relatorio#sumario`);
}
