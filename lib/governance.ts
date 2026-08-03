import { getAreaByKey } from "@/lib/areas";

export type GovernanceAlert = {
  areaKey: string;
  areaName: string;
  questionText: string;
  score: number;
};

type AnswerInput = { areaKey: string; questionId: string; score: number };

// Mesmo limiar de "crítico/frágil" já usado em findEvidenceGaps (lib/audit.ts).
const RISK_THRESHOLD = 2;

function scanQuestions(
  answers: AnswerInput[],
  targets: { areaKey: string; questionId: string }[]
): GovernanceAlert[] {
  const alerts: GovernanceAlert[] = [];

  for (const target of targets) {
    const answer = answers.find((a) => a.areaKey === target.areaKey && a.questionId === target.questionId);
    if (!answer || answer.score > RISK_THRESHOLD) continue;

    const area = getAreaByKey(target.areaKey);
    const question = area?.questions.find((q) => q.id === target.questionId);
    if (!area || !question) continue;

    alerts.push({ areaKey: area.key, areaName: area.name, questionText: question.text, score: answer.score });
  }

  return alerts;
}

/**
 * Agente de Risco Fiscal: sinaliza notas crítica/frágil (≤ 2) nas perguntas
 * fiscais que indicam exposição concreta, não maturidade geral da área.
 */
export function checkFiscalRisk(answers: AnswerInput[]): GovernanceAlert[] {
  return scanQuestions(answers, [
    { areaKey: "fiscal", questionId: "q4" }, // débitos fiscais em aberto
    { areaKey: "fiscal", questionId: "q5" }, // certidões negativas atualizadas
    { areaKey: "fiscal", questionId: "q8" }, // risco de classificação fiscal incorreta
    { areaKey: "fiscal", questionId: "q12" }, // passivos fiscais mapeados
  ]);
}

/**
 * Agente de Risco Trabalhista: mesma lógica nas perguntas de Pessoas e
 * Jurídico que apontam exposição trabalhista direta.
 */
export function checkLaborRisk(answers: AnswerInput[]): GovernanceAlert[] {
  return scanQuestions(answers, [
    { areaKey: "pessoas", questionId: "q12" }, // riscos trabalhistas relevantes
    { areaKey: "juridico", questionId: "q3" }, // contratos de trabalho bem definidos
  ]);
}

/**
 * Agente de Conformidade Contratual: contratos, licenças e exposição a
 * multas/processos — as perguntas jurídicas que tratam disso diretamente.
 */
export function checkContractCompliance(answers: AnswerInput[]): GovernanceAlert[] {
  return scanQuestions(answers, [
    { areaKey: "juridico", questionId: "q1" }, // contratos padrão com clientes
    { areaKey: "juridico", questionId: "q2" }, // contratos com fornecedores formalizados
    { areaKey: "juridico", questionId: "q9" }, // controle de vencimento de contratos
    { areaKey: "juridico", questionId: "q10" }, // licenças, alvarás ou autorizações obrigatórias
    { areaKey: "juridico", questionId: "q11" }, // exposição a multas, notificações ou processos
  ]);
}

export type LgpdDocumentInput = { aiSuggestedCategory: string | null };

export type LgpdAlert =
  | { type: "sem_politica"; areaName: string; questionText: string; score: number }
  | { type: "documento_sensivel"; documentCount: number };

/**
 * Agente LGPD: a pergunta jurídica sobre política de proteção de dados, mais
 * um alerta independente sempre que houver documento sensível (folha de
 * pagamento) no Data Room — não existe registro de consentimento na
 * plataforma, então a base legal de qualquer documento assim precisa ser
 * confirmada manualmente.
 */
export function checkLgpdCompliance(answers: AnswerInput[], documents: LgpdDocumentInput[]): LgpdAlert[] {
  const alerts: LgpdAlert[] = [];

  for (const gap of scanQuestions(answers, [{ areaKey: "juridico", questionId: "q6" }])) {
    alerts.push({ type: "sem_politica", areaName: gap.areaName, questionText: gap.questionText, score: gap.score });
  }

  const sensitiveDocs = documents.filter((d) => d.aiSuggestedCategory === "Folha de pagamento");
  if (sensitiveDocs.length > 0) {
    alerts.push({ type: "documento_sensivel", documentCount: sensitiveDocs.length });
  }

  return alerts;
}
