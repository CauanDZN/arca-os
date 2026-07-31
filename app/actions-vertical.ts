"use server";

import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";
import { getAreaByKey, VERTICAL_AGENT_AREAS } from "@/lib/areas";
import { generateVerticalInsight, type VerticalDocument } from "@/lib/ai";
import { extractDocumentText } from "@/lib/document-extract";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function generateVerticalInsightAction(diagnosticId: string, areaKey: string) {
  if (!(VERTICAL_AGENT_AREAS as readonly string[]).includes(areaKey)) {
    throw new Error("Área inválida para o Agente de Diagnóstico Vertical");
  }

  const area = getAreaByKey(areaKey);
  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { company: true, answers: { where: { areaKey } } },
  });
  if (!diagnostic || !area) throw new Error("Diagnóstico não encontrado");
  assertCompanyAccess(await getSession(), diagnostic.companyId);

  const report = buildReport(
    diagnostic.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
  );
  const areaScore = report.areaScores.find((a) => a.area.key === areaKey)!;

  const answerDetails = diagnostic.answers.map((a) => {
    const question = area.questions.find((q) => q.id === a.questionId);
    return {
      questionText: question?.text ?? a.questionId,
      score: a.score,
      evidence: a.evidence,
      responsible: a.responsible,
      impact: a.impact,
      urgency: a.urgency,
      risk: a.risk,
    };
  });

  const companyDocs = await prisma.document.findMany({
    where: { companyId: diagnostic.companyId, category: areaKey },
  });
  const documents: VerticalDocument[] = [];
  for (const doc of companyDocs) {
    try {
      const buffer = await fs.readFile(path.join(UPLOAD_ROOT, diagnostic.companyId, doc.storedName));
      const text = await extractDocumentText(buffer, doc.mimeType);
      if (text) documents.push({ name: doc.originalName, text });
    } catch (error) {
      console.error(`failed to read Data Room document ${doc.id} for vertical insight:`, error);
    }
  }

  const insight = await generateVerticalInsight(
    diagnostic.company.name,
    area.name,
    areaScore.average,
    areaScore.status,
    answerDetails,
    documents
  );

  if (insight) {
    await prisma.verticalInsight.upsert({
      where: { diagnosticId_areaKey: { diagnosticId, areaKey } },
      update: { content: JSON.stringify(insight), documentsUsed: documents.length },
      create: {
        diagnosticId,
        areaKey,
        content: JSON.stringify(insight),
        documentsUsed: documents.length,
      },
    });
  }

  redirect(`/diagnostico/${diagnosticId}/relatorio#especialistas`);
}
