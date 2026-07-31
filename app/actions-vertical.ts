"use server";

import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";
import { getAreaByKey, VERTICAL_AGENT_AREAS } from "@/lib/areas";
import { generateVerticalInsight, type VerticalDocument } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect } from "next/navigation";

// lib/document-extract is loaded lazily (it pulls in pdf-parse/pdfjs-dist, an
// ESM-only dependency). The relatorio page imports this file for the Server
// Action, and statically importing it here dragged those heavy deps into the
// page bundle — that's what made /diagnostico/[id]/relatorio fail at runtime
// with FUNCTION_INVOCATION_FAILED even though the build passed locally.

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
  const { extractDocumentText } = await import("@/lib/document-extract");
  for (const doc of companyDocs) {
    try {
      const response = await fetch(doc.storedUrl);
      if (!response.ok) throw new Error(`blob fetch returned ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
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
