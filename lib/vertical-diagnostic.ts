import type { Vertical } from "@/lib/verticals";
import { getAreaByKey } from "@/lib/areas";
import {
  statusForScore,
  maturityLevelForScore,
  timeframeForScore,
  priorityForScore,
  actionTextFor,
  type ActionItem,
} from "@/lib/scoring";

export type VerticalAnswerInput = {
  areaKey: string;
  questionId: string;
  score: number;
};

export type WeakVerticalQuestion = {
  areaKey: string;
  areaName: string;
  text: string;
  score: number;
};

export type VerticalReport = {
  verticalKey: string;
  verticalName: string;
  average: number;
  status: string;
  maturityLevel: number;
  maturityLabel: string;
  weakestQuestions: WeakVerticalQuestion[];
  actionItems: ActionItem[];
};

/**
 * Motor de relatório de módulo/vertical: mesma lógica de buildReport
 * (lib/scoring.ts), mas escopado às áreas de UMA vertical comercializável
 * (lib/verticals.ts), não as 12 inteiras — buildReport sempre trataria as
 * áreas de fora do escopo como nota 0, diluindo a média. Uma vertical pode
 * cobrir 1 área (Financeiro) ou várias (Comercial = comercial+marketing+
 * atendimento) — as respostas de todas elas entram juntas na mesma média.
 */
export function buildVerticalReport(vertical: Vertical, answers: VerticalAnswerInput[]): VerticalReport {
  const total = answers.reduce((sum, a) => sum + a.score, 0);
  const average = answers.length > 0 ? Math.round((total / answers.length) * 10) / 10 : 0;
  const status = statusForScore(average);
  const maturity = maturityLevelForScore(average);

  const weakestQuestions: WeakVerticalQuestion[] = answers
    .filter((a) => a.score <= 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((a) => {
      const area = getAreaByKey(a.areaKey);
      const question = area?.questions.find((q) => q.id === a.questionId);
      return {
        areaKey: a.areaKey,
        areaName: area?.name ?? a.areaKey,
        text: question?.text ?? a.questionId,
        score: a.score,
      };
    });

  const timeframe = timeframeForScore(average);
  const priority = priorityForScore(average);
  const actionSource: WeakVerticalQuestion[] =
    weakestQuestions.length > 0
      ? weakestQuestions
      : [
          {
            areaKey: vertical.areaKeys[0],
            areaName: vertical.name,
            text: `Melhoria geral em ${vertical.name}`,
            score: average,
          },
        ];

  const actionItems: ActionItem[] = actionSource.map((q) => ({
    areaKey: q.areaKey,
    areaName: q.areaName,
    problem: q.text,
    action: actionTextFor(q.text),
    priority,
    timeframe,
  }));

  return {
    verticalKey: vertical.key,
    verticalName: vertical.name,
    average,
    status,
    maturityLevel: maturity.level,
    maturityLabel: maturity.label,
    weakestQuestions,
    actionItems,
  };
}
