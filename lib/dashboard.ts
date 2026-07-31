import { prisma } from "@/lib/prisma";
import { AREAS } from "@/lib/areas";
import { buildReport, maturityLevelForScore, statusForScore } from "@/lib/scoring";
import type { Session } from "@/lib/session";

export type CompanyForDashboard = {
  id: string;
  name: string;
  segment: string;
  diagnostics: {
    id: string;
    status: string;
    createdAt: Date;
    answers: { areaKey: string; questionId: string; score: number }[];
    tasks: { status: string }[];
  }[];
};

export type AreaAverage = {
  areaKey: string;
  areaName: string;
  average: number;
  status: string;
};

export type CompanyRank = {
  id: string;
  name: string;
  segment: string;
  score: number;
  status: string;
  diagnosticDate: string;
};

export type SegmentCount = { segment: string; count: number };

export type DashboardData = {
  companyCount: number;
  diagnosticCount: number;
  avgScore: number | null;
  avgStatus: string;
  avgLevel: number | null;
  avgLevelLabel: string;
  executionPct: number | null;
  doneTasks: number;
  totalTasks: number;
  areaAverages: AreaAverage[];
  ranking: CompanyRank[];
  segments: SegmentCount[];
};

const UNKNOWN_SEGMENT = "Não informado";

export function aggregateDashboard(companies: CompanyForDashboard[]): DashboardData {
  const reports = companies.map((company) => {
    // Ignora diagnósticos sem nenhuma resposta — um esqueleto vazio distorceria a média.
    const latest = company.diagnostics.find((d) => d.answers.length > 0);
    const report = latest
      ? buildReport(latest.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score })))
      : null;
    return { company, latest, report };
  });

  const withReport = reports.filter((r) => r.report !== null);

  const areaAverages: AreaAverage[] = AREAS.map((area) => {
    const sum = withReport.reduce(
      (acc, r) => acc + (r.report!.areaScores.find((a) => a.area.key === area.key)?.average ?? 0),
      0
    );
    const average = withReport.length > 0 ? Math.round((sum / withReport.length) * 10) / 10 : 0;
    return { areaKey: area.key, areaName: area.name, average, status: statusForScore(average) };
  });

  const avgScore =
    withReport.length > 0
      ? Math.round((withReport.reduce((acc, r) => acc + r.report!.overallAverage, 0) / withReport.length) * 10) / 10
      : null;
  const avgLevel = avgScore === null ? null : maturityLevelForScore(avgScore);

  const ranking: CompanyRank[] = withReport
    .map((r) => ({
      id: r.company.id,
      name: r.company.name,
      segment: r.company.segment,
      score: r.report!.overallAverage,
      status: r.report!.overallStatus,
      diagnosticDate: r.latest!.createdAt.toISOString(),
    }))
    .sort((a, b) => b.score - a.score);

  const segmentCounts = new Map<string, number>();
  for (const c of companies) {
    const key = c.segment.trim() === "" ? UNKNOWN_SEGMENT : c.segment;
    segmentCounts.set(key, (segmentCounts.get(key) ?? 0) + 1);
  }
  const segments: SegmentCount[] = [...segmentCounts.entries()]
    .map(([segment, count]) => ({ segment, count }))
    .sort((a, b) => b.count - a.count);

  const allTasks = companies.flatMap((c) => c.diagnostics.flatMap((d) => d.tasks));
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;

  return {
    companyCount: companies.length,
    diagnosticCount: companies.reduce((acc, c) => acc + c.diagnostics.length, 0),
    avgScore,
    avgStatus: avgScore === null ? "Sem dados" : statusForScore(avgScore),
    avgLevel: avgLevel?.level ?? null,
    avgLevelLabel: avgLevel?.label ?? "",
    executionPct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null,
    doneTasks,
    totalTasks,
    areaAverages,
    ranking,
    segments,
  };
}

// Dashboard scoped: cliente enxerga só a própria empresa; admin/consultor veem
// a carteira toda.
export async function buildDashboardData(session: Session | null): Promise<DashboardData> {
  const where = session?.role === "cliente" && session.companyId ? { id: session.companyId } : {};

  const companies = await prisma.company.findMany({
    where,
    include: {
      diagnostics: {
        orderBy: { createdAt: "desc" },
        include: { answers: true, tasks: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return aggregateDashboard(companies);
}
