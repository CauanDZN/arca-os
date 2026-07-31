import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";
import { reportAreasToCsv } from "@/lib/csv";
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

  const csv = reportAreasToCsv(report);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="diagnostico-${diagnostic.company.name.replace(/\s+/g, "-")}.csv"`,
    },
  });
}
