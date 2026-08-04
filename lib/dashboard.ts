import { prisma } from "@/lib/prisma";
import { AREAS } from "@/lib/areas";
import { buildReport, maturityLevelForScore, MATURITY_LEVELS, statusForScore } from "@/lib/scoring";
import { verticalAverages as computeVerticalAverages, type VerticalAverage } from "@/lib/verticals";
import { findAtRiskTasks, type PmoAlertReason } from "@/lib/pmo";
import type { BadgeTone } from "@/lib/badge-tones";
import type { Session } from "@/lib/session";
import { getConsultorVerticalScope } from "@/lib/access";

export type CompanyForDashboard = {
  id: string;
  name: string;
  segment: string;
  diagnostics: {
    id: string;
    status: string;
    createdAt: Date;
    answers: { areaKey: string; questionId: string; score: number }[];
    tasks: {
      id: string;
      title: string;
      areaName: string;
      status: string;
      dueDate: Date | null;
      responsible: string;
    }[];
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
  maturityLevel: number;
  diagnosticDate: string;
};

export type SegmentCount = { segment: string; count: number };

export type LevelCount = { level: number; label: string; count: number };

export type AtRiskTask = {
  taskId: string;
  title: string;
  areaName: string;
  reason: PmoAlertReason;
  companyId: string;
  companyName: string;
  dueDate: string | null;
};

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
  verticalAverages: VerticalAverage[];
  ranking: CompanyRank[];
  segments: SegmentCount[];
  levelDistribution: LevelCount[];
  atRiskTasks: AtRiskTask[];
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
      maturityLevel: r.report!.maturityLevel,
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

  const levelDistribution: LevelCount[] = MATURITY_LEVELS.map((lvl) => ({
    level: lvl.level,
    label: lvl.label,
    count: ranking.filter((r) => r.maturityLevel === lvl.level).length,
  }));

  const verticalAverages = computeVerticalAverages(areaAverages);

  const allTasks = companies.flatMap((c) =>
    c.diagnostics.flatMap((d) => d.tasks.map((t) => ({ ...t, companyId: c.id, companyName: c.name })))
  );
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;

  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const atRiskTasks: AtRiskTask[] = findAtRiskTasks(allTasks)
    .map((alert) => {
      const task = taskById.get(alert.taskId)!;
      return {
        taskId: alert.taskId,
        title: alert.title,
        areaName: alert.areaName,
        reason: alert.reason,
        companyId: task.companyId,
        companyName: task.companyName,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      };
    })
    .sort((a, b) => {
      if (a.reason !== b.reason) return a.reason === "atrasada" ? -1 : 1;
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    })
    .slice(0, 8);

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
    verticalAverages,
    ranking,
    segments,
    levelDistribution,
    atRiskTasks,
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

  const scope = getConsultorVerticalScope(session);
  const scoped = scope
    ? companies.filter((c) => {
        const contracted: string[] = JSON.parse(c.contractedVerticals || "[]");
        return contracted.some((key) => scope.includes(key));
      })
    : companies;

  return aggregateDashboard(scoped);
}

export type Observation = { text: string; tone: BadgeTone };

// Leitura em regras (sem IA) do panorama do dashboard — sempre disponível, sem
// depender de GEMINI_API_KEY nem gerar latência na renderização da página.
export function buildObservations(data: DashboardData): Observation[] {
  const observations: Observation[] = [];

  const scoredVerticals = data.verticalAverages.filter((v) => v.average > 0);
  if (scoredVerticals.length > 0) {
    const weakest = [...scoredVerticals].sort((a, b) => a.average - b.average)[0];
    const strongest = [...scoredVerticals].sort((a, b) => b.average - a.average)[0];
    observations.push({
      text: `Maior gargalo: ${weakest.name} (${weakest.average.toFixed(1)}/5).`,
      tone: "warning",
    });
    if (strongest.key !== weakest.key) {
      observations.push({
        text: `Ponto mais forte: ${strongest.name} (${strongest.average.toFixed(1)}/5).`,
        tone: "good",
      });
    }
  }

  if (data.atRiskTasks.length > 0) {
    const overdueCount = data.atRiskTasks.filter((t) => t.reason === "atrasada").length;
    const plural = data.atRiskTasks.length === 1 ? "" : "s";
    observations.push({
      text:
        `${data.atRiskTasks.length} pendência${plural} do plano de ação precisa${plural ? "m" : ""} de atenção` +
        (overdueCount > 0 ? ` — ${overdueCount} atrasada${overdueCount === 1 ? "" : "s"}.` : "."),
      tone: "warning",
    });
  }

  if (data.executionPct !== null) {
    if (data.executionPct < 30) {
      observations.push({
        text: `Execução do plano em ${data.executionPct}% — abaixo do esperado, vale reforçar o acompanhamento.`,
        tone: "warning",
      });
    } else if (data.executionPct >= 70) {
      observations.push({
        text: `Execução do plano em ${data.executionPct}% — ritmo saudável.`,
        tone: "good",
      });
    }
  }

  const earlyStage = data.levelDistribution.filter((l) => l.level <= 2).reduce((acc, l) => acc + l.count, 0);
  if (data.companyCount > 0 && earlyStage / data.companyCount > 0.5) {
    const plural = earlyStage === 1 ? "" : "s";
    observations.push({
      text: `${earlyStage} de ${data.companyCount} empresa${plural} ainda ${earlyStage === 1 ? "está" : "estão"} nos níveis iniciais de maturidade (1–2).`,
      tone: "warning",
    });
  }

  if (data.ranking.length >= 2) {
    const top = data.ranking[0];
    const bottom = data.ranking[data.ranking.length - 1];
    if (top.score - bottom.score >= 2) {
      observations.push({
        text: `Grande dispersão de maturidade na carteira: ${top.name} (${top.score.toFixed(1)}/5) vs. ${bottom.name} (${bottom.score.toFixed(1)}/5).`,
        tone: "neutral",
      });
    }
  }

  return observations;
}
