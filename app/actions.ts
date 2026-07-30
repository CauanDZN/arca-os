"use server";

import { prisma } from "@/lib/prisma";
import { AREAS, getAreaIndex } from "@/lib/areas";
import { buildReport } from "@/lib/scoring";
import { generateAiNarrative } from "@/lib/ai";
import { redirect } from "next/navigation";

export async function createDiagnostic(formData: FormData) {
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
  const area = AREAS.find((a) => a.key === areaKey);
  if (!area) throw new Error("Área inválida");

  for (const question of area.questions) {
    const raw = formData.get(question.id);
    const score = raw !== null ? Number(raw) : 0;
    const evidence = String(formData.get(`${question.id}__evidence`) ?? "");
    const responsible = String(formData.get(`${question.id}__responsible`) ?? "");
    const impact = String(formData.get(`${question.id}__impact`) ?? "Médio");
    const urgency = String(formData.get(`${question.id}__urgency`) ?? "Média");
    const risk = String(formData.get(`${question.id}__risk`) ?? "Operacional");

    await prisma.answer.upsert({
      where: {
        diagnosticId_areaKey_questionId: {
          diagnosticId,
          areaKey,
          questionId: question.id,
        },
      },
      update: { score, evidence, responsible, impact, urgency, risk },
      create: {
        diagnosticId,
        areaKey,
        questionId: question.id,
        score,
        evidence,
        responsible,
        impact,
        urgency,
        risk,
      },
    });
  }

  const currentIndex = getAreaIndex(areaKey);
  const nextArea = AREAS[currentIndex + 1];

  if (nextArea) {
    redirect(`/diagnostico/${diagnosticId}/questionario/${nextArea.key}`);
  } else {
    const diagnostic = await prisma.diagnostic.findUnique({
      where: { id: diagnosticId },
      include: { company: true, answers: true },
    });

    let aiNarrative: string | null = null;
    if (diagnostic) {
      const report = buildReport(
        diagnostic.answers.map((a) => ({
          areaKey: a.areaKey,
          questionId: a.questionId,
          score: a.score,
        }))
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
      if (narrative) aiNarrative = JSON.stringify(narrative);
    }

    await prisma.diagnostic.update({
      where: { id: diagnosticId },
      data: { status: "concluido", aiNarrative },
    });
    redirect(`/diagnostico/${diagnosticId}/relatorio`);
  }
}
