import { getAreaByKey } from "@/lib/areas";

// Agente de Sinergia entre Verticais (plano estratégico, p. 14): hoje cada
// módulo de vertical é uma ilha — o relatório de Comercial não sabe que o de
// Marketing existe, mesmo quando a mesma empresa contratou os dois. Este
// agente cruza pares de perguntas fracas de VERTICAIS DIFERENTES que, juntas,
// descrevem o mesmo problema de raiz por dois ângulos — não dois problemas
// separados. Mesma filosofia de lib/governance.ts (regra fixa, sem IA): os
// pares vêm direto dos 6 exemplos de sinergia citados no plano (Finanças +
// Comercial, RH + Estratégia, Marketing + Comercial, Governança + Finanças,
// Processos + Tecnologia, Contábil + Estratégia).
const RISK_THRESHOLD = 2;

type QuestionTarget = { areaKey: string; questionId: string };

export type SynergyRule = {
  key: string;
  title: string;
  insight: string;
  targetA: QuestionTarget;
  targetB: QuestionTarget;
};

export const SYNERGY_RULES: SynergyRule[] = [
  {
    key: "precificacao",
    title: "Finanças + Comercial — precificação sem base de custo real",
    insight:
      "O Financeiro não precifica considerando custo e margem, e o Comercial não sabe quais produtos ou serviços são mais rentáveis — é o mesmo problema de precificação visto de dois lados, não dois problemas.",
    targetA: { areaKey: "financeiro", questionId: "q10" },
    targetB: { areaKey: "comercial", questionId: "q10" },
  },
  {
    key: "dependencia_dono",
    title: "Pessoas + Estratégia — dependência de pessoas-chave sem organograma",
    insight:
      "Não há organograma atualizado nem clareza de papéis — a empresa provavelmente depende do dono ou de pessoas-chave sem plano de sucessão, mesmo risco visto do lado de RH e do lado da governança.",
    targetA: { areaKey: "pessoas", questionId: "q1" },
    targetB: { areaKey: "estrategia", questionId: "q4" },
  },
  {
    key: "funil_demanda",
    title: "Marketing + Comercial — funil não alimentado por demanda qualificada",
    insight:
      "Não existe integração entre marketing e vendas, e o funil comercial não está estruturado — os leads que o Marketing eventualmente gera não têm onde aterrissar, e o Comercial não tem demanda organizada de onde puxar.",
    targetA: { areaKey: "marketing", questionId: "q10" },
    targetB: { areaKey: "comercial", questionId: "q2" },
  },
  {
    key: "governanca_financeira",
    title: "Estratégia + Finanças — governança financeira frágil",
    insight:
      "Não há separação entre finanças pessoais dos sócios e da empresa, e as retiradas não são planejadas — falta de controle interno que aparece tanto no diagnóstico de Estratégia quanto no de Finanças.",
    targetA: { areaKey: "estrategia", questionId: "q7" },
    targetB: { areaKey: "financeiro", questionId: "q11" },
  },
  {
    key: "processos_automacao",
    title: "Operações + Tecnologia — nada pra automatizar porque nada está documentado",
    insight:
      "Não há processos operacionais documentados nem automações em processos repetitivos — não dá pra automatizar o que nunca foi mapeado; a causa é a mesma, o sintoma aparece nos dois diagnósticos.",
    targetA: { areaKey: "operacoes", questionId: "q1" },
    targetB: { areaKey: "tecnologia", questionId: "q8" },
  },
  {
    key: "planejamento_tributario",
    title: "Fiscal + Estratégia — planejamento tributário desalinhado da estratégia",
    insight:
      "Não existe planejamento tributário documentado, e a empresa também não tem planejamento estratégico formal — decisões de crescimento sendo tomadas sem considerar o impacto tributário, e vice-versa.",
    targetA: { areaKey: "fiscal", questionId: "q11" },
    targetB: { areaKey: "estrategia", questionId: "q1" },
  },
];

export type AnswerInput = { areaKey: string; questionId: string; score: number };

export type SynergyFinding = {
  areaKey: string;
  areaName: string;
  questionText: string;
  score: number;
};

export type SynergyAlert = {
  key: string;
  title: string;
  insight: string;
  findings: [SynergyFinding, SynergyFinding];
};

function resolveFinding(answers: AnswerInput[], target: QuestionTarget): SynergyFinding | null {
  const answer = answers.find((a) => a.areaKey === target.areaKey && a.questionId === target.questionId);
  if (!answer || answer.score > RISK_THRESHOLD) return null;

  const area = getAreaByKey(target.areaKey);
  const question = area?.questions.find((q) => q.id === target.questionId);
  if (!area || !question) return null;

  return { areaKey: area.key, areaName: area.name, questionText: question.text, score: answer.score };
}

/**
 * Cruza respostas de verticais diferentes da MESMA empresa — o chamador é
 * responsável por juntar as respostas de todos os diagnósticos relevantes
 * (um por vertical contratada, ou um diagnóstico completo) antes de chamar.
 * Só dispara quando AMBOS os lados do par estão respondidos e fracos (nota
 * ≤ 2) — uma vertical não respondida não gera alerta.
 */
export function findVerticalSynergies(answers: AnswerInput[]): SynergyAlert[] {
  const alerts: SynergyAlert[] = [];

  for (const rule of SYNERGY_RULES) {
    const findingA = resolveFinding(answers, rule.targetA);
    const findingB = resolveFinding(answers, rule.targetB);
    if (!findingA || !findingB) continue;

    alerts.push({ key: rule.key, title: rule.title, insight: rule.insight, findings: [findingA, findingB] });
  }

  return alerts;
}
