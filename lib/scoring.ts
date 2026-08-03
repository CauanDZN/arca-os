import { AREAS, type Area } from "@/lib/areas";

export type AnswerInput = {
  areaKey: string;
  questionId: string;
  score: number;
};

export type AreaScore = {
  area: Area;
  average: number;
  status: string;
  weakestQuestions: { text: string; score: number }[];
};

export type PriorityItem = {
  areaKey: string;
  areaName: string;
  average: number;
  classification: "Estrutural" | "Quick Win" | "Corretiva" | "Estratégica" | "Não prioritária";
};

export type ActionItem = {
  areaKey: string;
  areaName: string;
  problem: string;
  action: string;
  priority: "Alta" | "Média" | "Baixa";
  timeframe: "30 dias" | "31 a 90 dias" | "3 a 12 meses";
};

export type Report = {
  overallAverage: number;
  overallStatus: string;
  maturityLevel: number;
  maturityLabel: string;
  areaScores: AreaScore[];
  strengths: AreaScore[];
  risks: AreaScore[];
  priorityMatrix: PriorityItem[];
  actionPlan: {
    days30: ActionItem[];
    days90: ActionItem[];
    months12: ActionItem[];
  };
};

const RISK_AREAS = new Set(["fiscal", "juridico", "pessoas"]);

export function statusForScore(avg: number): string {
  if (avg < 1.5) return "Crítico";
  if (avg < 2.5) return "Frágil";
  if (avg < 3.5) return "Em estruturação";
  if (avg < 4.5) return "Gerenciado";
  return "Otimizado";
}

export type MaturityLevel = {
  level: number;
  label: string;
  description: string;
};

// Motor de Maturidade em 5 níveis (Empresa informal → Escalável), a linguagem
// do pitch do Cícero. A nota 0–5 de cada diagnóstico é traduzida num nível.
export const MATURITY_LEVELS: MaturityLevel[] = [
  {
    level: 1,
    label: "Empresa Informal",
    description: "Gestão reativa — roda no improviso e na figura do dono.",
  },
  {
    level: 2,
    label: "Empresa Operacional",
    description: "Já opera no dia a dia, mas com processos informais e dependentes de pessoas-chave.",
  },
  {
    level: 3,
    label: "Empresa Estruturada",
    description: "Rotinas, papéis e indicadores definidos — a execução ainda é manual.",
  },
  {
    level: 4,
    label: "Empresa Gerenciada",
    description: "Decisões orientadas a dados, com metas, planos de ação e comitê de gestão.",
  },
  {
    level: 5,
    label: "Empresa Escalável",
    description: "Operação padronizada e replicável — pronta para crescer sem o dono.",
  },
];

export function maturityLevelForScore(avg: number): MaturityLevel {
  if (avg < 1) return MATURITY_LEVELS[0];
  if (avg < 2) return MATURITY_LEVELS[1];
  if (avg < 3) return MATURITY_LEVELS[2];
  if (avg < 4) return MATURITY_LEVELS[3];
  return MATURITY_LEVELS[4];
}

function classify(areaKey: string, avg: number): PriorityItem["classification"] {
  if (avg >= 4.5) return "Não prioritária";
  if (avg < 1.5) return "Estrutural";
  if (avg < 2.5) return "Quick Win";
  if (avg < 3.5) return RISK_AREAS.has(areaKey) ? "Corretiva" : "Quick Win";
  return "Estratégica";
}

export function timeframeForScore(avg: number): ActionItem["timeframe"] {
  if (avg < 2) return "30 dias";
  if (avg < 3.5) return "31 a 90 dias";
  return "3 a 12 meses";
}

export function priorityForScore(avg: number): ActionItem["priority"] {
  if (avg < 2) return "Alta";
  if (avg < 3.5) return "Média";
  return "Baixa";
}

export function actionTextFor(questionText: string): string {
  const stripped = questionText.replace(/\?$/, "");
  return `Estruturar: ${stripped}`;
}

export function buildReport(answers: AnswerInput[]): Report {
  const answersByArea = new Map<string, AnswerInput[]>();
  for (const answer of answers) {
    const list = answersByArea.get(answer.areaKey) ?? [];
    list.push(answer);
    answersByArea.set(answer.areaKey, list);
  }

  const areaScores: AreaScore[] = AREAS.map((area) => {
    const areaAnswers = answersByArea.get(area.key) ?? [];
    const total = areaAnswers.reduce((sum, a) => sum + a.score, 0);
    const average = areaAnswers.length > 0 ? total / areaAnswers.length : 0;

    const weakestQuestions = areaAnswers
      .filter((a) => a.score <= 2)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((a) => {
        const question = area.questions.find((q) => q.id === a.questionId);
        return { text: question?.text ?? a.questionId, score: a.score };
      });

    return {
      area,
      average: Math.round(average * 10) / 10,
      status: statusForScore(average),
      weakestQuestions,
    };
  });

  const overallAverage =
    Math.round((areaScores.reduce((sum, a) => sum + a.average, 0) / areaScores.length) * 10) / 10;
  const overallStatus = statusForScore(overallAverage);

  const sortedByScore = [...areaScores].sort((a, b) => a.average - b.average);
  const risks = sortedByScore.slice(0, 3);
  const strengths = [...areaScores].sort((a, b) => b.average - a.average).slice(0, 3);

  const priorityMatrix: PriorityItem[] = sortedByScore.map((a) => ({
    areaKey: a.area.key,
    areaName: a.area.name,
    average: a.average,
    classification: classify(a.area.key, a.average),
  }));

  const actionPlan: Report["actionPlan"] = { days30: [], days90: [], months12: [] };

  for (const areaScore of sortedByScore) {
    if (areaScore.average >= 4.5) continue;
    const timeframe = timeframeForScore(areaScore.average);
    const priority = priorityForScore(areaScore.average);
    const items = (areaScore.weakestQuestions.length > 0
      ? areaScore.weakestQuestions
      : [{ text: `Melhoria geral em ${areaScore.area.name}`, score: areaScore.average }]
    ).map((q) => ({
      areaKey: areaScore.area.key,
      areaName: areaScore.area.name,
      problem: q.text,
      action: actionTextFor(q.text),
      priority,
      timeframe,
    }));

    if (timeframe === "30 dias") actionPlan.days30.push(...items);
    else if (timeframe === "31 a 90 dias") actionPlan.days90.push(...items);
    else actionPlan.months12.push(...items);
  }

  const maturity = maturityLevelForScore(overallAverage);

  return {
    overallAverage,
    overallStatus,
    maturityLevel: maturity.level,
    maturityLabel: maturity.label,
    areaScores,
    strengths,
    risks,
    priorityMatrix,
    actionPlan,
  };
}
