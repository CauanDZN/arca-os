import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";
import { renderReportPdf } from "@/lib/pdf";
import type { AiNarrative } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id },
    include: { company: true, answers: true },
  });

  if (!diagnostic) {
    return NextResponse.json({ error: "Diagnóstico não encontrado" }, { status: 404 });
  }

  const session = await getSession();
  if (!session || (session.role === "cliente" && session.companyId !== diagnostic.companyId)) {
    return NextResponse.json({ error: "Diagnóstico não encontrado" }, { status: 404 });
  }

  const report = buildReport(
    diagnostic.answers.map((a) => ({
      areaKey: a.areaKey,
      questionId: a.questionId,
      score: a.score,
    }))
  );

  const aiNarrative: AiNarrative | null = diagnostic.aiNarrative
    ? JSON.parse(diagnostic.aiNarrative)
    : null;

  const buffer = await renderReportPdf({
    companyName: diagnostic.company.name,
    segment: diagnostic.company.segment,
    objectives: JSON.parse(diagnostic.company.objectives || "[]"),
    report,
    aiNarrative,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-${diagnostic.company.name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
