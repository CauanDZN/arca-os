import { prisma } from "@/lib/prisma";
import { getAreaByKey } from "@/lib/areas";
import { kpiEntriesToCsv } from "@/lib/csv";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const session = await getSession();
  if (!session || (session.role === "cliente" && session.companyId !== id)) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const entries = await prisma.kpiEntry.findMany({
    where: { companyId: id },
    orderBy: [{ areaKey: "asc" }, { indicatorName: "asc" }, { month: "asc" }],
  });

  const csv = kpiEntriesToCsv(
    entries.map((e) => ({
      areaName: getAreaByKey(e.areaKey)?.name ?? e.areaKey,
      indicatorName: e.indicatorName,
      month: e.month,
      value: e.value,
      target: e.target,
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="indicadores-${company.name.replace(/\s+/g, "-")}.csv"`,
    },
  });
}
