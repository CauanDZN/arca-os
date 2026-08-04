// Estrutura de receita Arca BTO (plano estratégico, p. 24) — funções puras.
// A apuração de performance fee é deliberadamente simples: gainValue (o
// ganho em R$ do cliente no período) é entrada manual do consultor, não
// derivado de KpiEntry — a direção de "melhora" varia por indicador
// (Inadimplência caindo é bom, Receita mensal caindo é ruim) e adivinhar
// errado calcularia comissão errada. O que É automatizável com segurança é
// a multiplicação — isso sim vira código.

export function computeFeeValue(gainValue: number, feePercent: number): number {
  return Math.round(gainValue * (feePercent / 100) * 100) / 100;
}

export type ContractForMrr = { type: string; status: string; value: number | null };

// Soma dos contratos MRR ativos — a "receita recorrente mensal" que o plano
// estratégico usa como um dos 4 componentes da estrutura de receita.
export function totalActiveMrr(contracts: ContractForMrr[]): number {
  return contracts
    .filter((c) => c.type === "mrr" && c.status === "ativo")
    .reduce((sum, c) => sum + (c.value ?? 0), 0);
}
