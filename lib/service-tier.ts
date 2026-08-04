// Escada de serviço por vertical (plano estratégico, Nível 1-4 de cada
// vertical) — eixo DIFERENTE da maturidade 1-5 do diagnóstico
// (lib/scoring.ts): maturidade mede a saúde da empresa NA vertical; nível de
// serviço mede em que estágio da relação comercial a Arca está COM a
// empresa nessa vertical. Uma empresa pode estar em maturidade 2 (frágil) e
// nível de serviço 2 (Execução) ao mesmo tempo — são perguntas diferentes.
//
// Só os níveis 1-3 são detectáveis a partir de dado que já existe no banco
// (diagnóstico → plano aprovado → indicadores sendo medidos). Nível 4
// (Especialista) descreve serviços avançados e sob medida do plano
// (valuation, M&A, reestruturação societária, due diligence) que não têm
// contrapartida em dado estruturado — não tem como o sistema "detectar"
// isso sem inventar um proxy, então ele nunca é atribuído automaticamente.
export type ServiceTierLevel = 1 | 2 | 3 | 4;

export type ServiceTier = {
  level: ServiceTierLevel;
  label: string;
  description: string;
};

const TIER_INFO: Record<ServiceTierLevel, { label: string; description: string }> = {
  1: { label: "Diagnóstico", description: "Assessment da vertical e avaliação de maturidade." },
  2: { label: "Execução", description: "Plano de ação e playbook em execução no Kanban." },
  3: { label: "Performance", description: "Indicadores da vertical acompanhados mês a mês no Cockpit de Performance." },
  4: { label: "Especialista", description: "Serviços avançados sob avaliação da Arca — não detectado automaticamente." },
};

export function determineServiceTierLevel(input: {
  hasCompletedDiagnostic: boolean;
  hasApprovedPlan: boolean;
  hasKpiTracking: boolean;
}): ServiceTierLevel {
  if (!input.hasCompletedDiagnostic) return 1;
  if (input.hasApprovedPlan && input.hasKpiTracking) return 3;
  if (input.hasApprovedPlan) return 2;
  return 1;
}

export function getServiceTier(level: ServiceTierLevel): ServiceTier {
  return { level, ...TIER_INFO[level] };
}

export const SERVICE_TIER_LEVELS: ServiceTierLevel[] = [1, 2, 3, 4];
