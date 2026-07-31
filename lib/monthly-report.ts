import { AREAS } from "@/lib/areas";
import { buildReport, maturityLevelForScore } from "@/lib/scoring";
import { findAtRiskTasks } from "@/lib/pmo";

export type MonthlyReportInput = {
  period: string; // "YYYY-MM"
  answers: { areaKey: string; questionId: string; score: number }[];
  tasks: {
    id: string;
    title: string;
    areaName: string;
    status: string;
    dueDate: Date | null;
    responsible: string;
  }[];
  decisionsCount: number;
  kpiCount: number;
};

export type MonthlyReportData = {
  period: string;
  overallAverage: number;
  overallStatus: string;
  maturityLevel: number;
  maturityLabel: string;
  areaAverages: { areaKey: string; areaName: string; average: number; status: string }[];
  taskStats: { total: number; done: number; pct: number; overdue: number; noOwner: number };
  pendingCount: number;
  decisionsCount: number;
  kpiCount: number;
};

// Scorecard mensal do Comitê de Gestão. Puro e testável: o cron e o botão
// manual só transformam o snapshot do banco nesses dados e persistem.
export function buildMonthlyReport(
  input: MonthlyReportInput,
  now: Date = new Date()
): MonthlyReportData | null {
  if (input.answers.length === 0) return null;

  const report = buildReport(input.answers);
  const alerts = findAtRiskTasks(input.tasks, now);

  const pendingTasks = input.tasks.filter((t) => t.status !== "done");
  const done = input.tasks.filter((t) => t.status === "done").length;
  const overdue = new Set(alerts.filter((a) => a.reason === "atrasada").map((a) => a.taskId)).size;
  const noOwner = alerts.filter((a) => a.reason === "sem_responsavel").length;

  const level = maturityLevelForScore(report.overallAverage);

  return {
    period: input.period,
    overallAverage: report.overallAverage,
    overallStatus: report.overallStatus,
    maturityLevel: level.level,
    maturityLabel: level.label,
    areaAverages: report.areaScores.map((a) => ({
      areaKey: a.area.key,
      areaName: a.area.name,
      average: a.average,
      status: a.status,
    })),
    taskStats: {
      total: input.tasks.length,
      done,
      pct: input.tasks.length > 0 ? Math.round((done / input.tasks.length) * 100) : 0,
      overdue,
      noOwner,
    },
    pendingCount: pendingTasks.length,
    decisionsCount: input.decisionsCount,
    kpiCount: input.kpiCount,
  };
}

// Mês corrente no fuso Brasil (America/Sao_Paulo) no formato "YYYY-MM".
export function currentPeriod(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

// Áreas que ainda não têm nota no relatório — para o cron não criar scorecards
// vazios quando só um pedaço do questionário foi respondido.
export function coveredAreaKeys(answers: { areaKey: string }[]): Set<string> {
  const keys = new Set<string>();
  for (const a of answers) keys.add(a.areaKey);
  return keys;
}

export const AREA_COUNT = AREAS.length;
