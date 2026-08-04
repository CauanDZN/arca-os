// Organograma por vertical (plano estratégico, p. 22): os 5 níveis de
// senioridade que se repetem sob cada uma das verticais. Ordem do topo pra
// base — usada tanto no <select> de /usuarios quanto na ordenação das
// colunas do organograma.
export const SENIORITY_LEVELS = ["socio", "gerente", "coordenador", "analista", "assistente"] as const;
export type Seniority = (typeof SENIORITY_LEVELS)[number];

export const SENIORITY_LABEL: Record<Seniority, string> = {
  socio: "Sócio",
  gerente: "Gerente",
  coordenador: "Coordenador",
  analista: "Analista",
  assistente: "Assistente",
};

export function isSeniority(value: string): value is Seniority {
  return (SENIORITY_LEVELS as readonly string[]).includes(value);
}
