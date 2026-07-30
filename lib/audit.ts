import { AREAS } from "@/lib/areas";

export type EvidenceAlert = {
  areaKey: string;
  areaName: string;
  questionText: string;
  score: number;
};

type AnsweredQuestion = {
  areaKey: string;
  questionId: string;
  score: number;
  evidence: string;
};

/**
 * Agente de Auditoria de Evidências: flags critical/fragile answers (score <= 2)
 * that have no evidence attached, so they don't silently drive the report and
 * the action plan without anything backing them up.
 */
export function findEvidenceGaps(answers: AnsweredQuestion[]): EvidenceAlert[] {
  const alerts: EvidenceAlert[] = [];

  for (const answer of answers) {
    if (answer.score > 2) continue;
    if (answer.evidence.trim().length > 0) continue;

    const area = AREAS.find((a) => a.key === answer.areaKey);
    const question = area?.questions.find((q) => q.id === answer.questionId);
    if (!area || !question) continue;

    alerts.push({
      areaKey: area.key,
      areaName: area.name,
      questionText: question.text,
      score: answer.score,
    });
  }

  return alerts;
}
