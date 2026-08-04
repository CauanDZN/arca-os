// Metas de KPI por vertical (plano estratégico, blocos "KPIs Esperados" de cada
// vertical, p. 5-13). Curado à mão, não é uma transcrição literal — o PDF só é
// legível de forma confiável quando o número já é um NÍVEL absoluto ("100%",
// "≥80%", "90%"); quando é um DELTA relativo ("+15% a +30%", "-25%") o plano
// não diz a linha de base, então não dá pra transformar isso num "target"
// comparável direto com KpiEntry.value (que já assume "value >= target" =
// meta batida — inventar um target level pra um delta calcularia errado, mesma
// razão pela qual gainValue de Performance Fee é manual, ver lib/contracts.ts).
// Por isso: kind "nivel" pré-preenche o campo Meta; kind "delta" só aparece
// como referência de texto — o consultor calcula o valor absoluto a partir do
// mês corrente antes de preencher.
//
// Só entram aqui os pares (areaKey, indicatorName) que já existem em
// lib/areas.ts — sem inventar nome de indicador novo, pra não desalinhar do
// <select> do Cockpit de Performance. Isso significa cobertura parcial dos
// KPIs do PDF por vertical (às vezes só 1 de 6) — parcial e correto é melhor
// que completo e inventado. "gestao_rotina" não é uma das 8 verticais do PDF
// (é própria do ArcaOS), por isso não tem entradas aqui. "operacoes" é o
// equivalente mais próximo de "Processos & Projetos" do plano — não é uma
// tradução 1:1, mas é a vertical existente com objetivo mais parecido.
export type KpiTargetSuggestion = {
  verticalKey: string;
  areaKey: string;
  indicatorName: string;
  kind: "nivel" | "delta";
  value: number | null; // preenchido só quando kind === "nivel"
  label: string; // leitura literal do plano, exibida sempre
};

export const KPI_TARGET_SUGGESTIONS: KpiTargetSuggestion[] = [
  // Comercial, Growth e Sucesso do Cliente
  { verticalKey: "comercial", areaKey: "comercial", indicatorName: "Receita recorrente", kind: "nivel", value: 90, label: "90% (previsibilidade de receita)" },
  { verticalKey: "comercial", areaKey: "comercial", indicatorName: "Taxa de conversão", kind: "delta", value: null, label: "+15% a +30%" },
  { verticalKey: "comercial", areaKey: "comercial", indicatorName: "Ticket médio", kind: "delta", value: null, label: "+10% a +20%" },
  { verticalKey: "comercial", areaKey: "comercial", indicatorName: "Leads gerados", kind: "delta", value: null, label: "+40% (leads qualificados)" },
  { verticalKey: "comercial", areaKey: "atendimento", indicatorName: "Churn", kind: "delta", value: null, label: "-25% (redução)" },

  // Financeiro e Controladoria
  { verticalKey: "financeiro", areaKey: "financeiro", indicatorName: "Inadimplência", kind: "delta", value: null, label: "-30% (redução)" },
  { verticalKey: "financeiro", areaKey: "financeiro", indicatorName: "Lucro líquido", kind: "delta", value: null, label: "+5 p.p. de margem líquida" },
  { verticalKey: "financeiro", areaKey: "financeiro", indicatorName: "Custo fixo sobre receita", kind: "delta", value: null, label: "-10% a -20% (redução de despesas operacionais)" },

  // Marketing e Comunicação
  { verticalKey: "marketing", areaKey: "marketing", indicatorName: "Leads por campanha", kind: "delta", value: null, label: "+40% (leads qualificados)" },
  { verticalKey: "marketing", areaKey: "marketing", indicatorName: "Custo por aquisição", kind: "delta", value: null, label: "-15% (redução de CAC)" },
  { verticalKey: "marketing", areaKey: "marketing", indicatorName: "Conversão por canal", kind: "delta", value: null, label: "+20%" },
  { verticalKey: "marketing", areaKey: "marketing", indicatorName: "Alcance", kind: "delta", value: null, label: "+35% (brand awareness)" },

  // Pessoas e Cultura
  { verticalKey: "pessoas", areaKey: "pessoas", indicatorName: "Clima organizacional", kind: "delta", value: null, label: "+30% (engajamento de equipe)" },
  { verticalKey: "pessoas", areaKey: "pessoas", indicatorName: "Produtividade por pessoa", kind: "delta", value: null, label: "+15%" },
  { verticalKey: "pessoas", areaKey: "pessoas", indicatorName: "Turnover", kind: "delta", value: null, label: "-25% (redução)" },

  // Operações e Suprimentos (equivalente mais próximo de "Processos & Projetos")
  { verticalKey: "operacoes", areaKey: "operacoes", indicatorName: "Retrabalho", kind: "delta", value: null, label: "-40% (redução)" },
  { verticalKey: "operacoes", areaKey: "operacoes", indicatorName: "Prazo médio de entrega", kind: "delta", value: null, label: "-25% (redução do tempo de ciclo)" },
  { verticalKey: "operacoes", areaKey: "operacoes", indicatorName: "Qualidade percebida", kind: "delta", value: null, label: "+35% (melhoria na qualidade)" },

  // Estratégia e Governança
  { verticalKey: "estrategia", areaKey: "estrategia", indicatorName: "% metas atingidas", kind: "nivel", value: 85, label: "≥85% (metas estratégicas cumpridas)" },

  // Tecnologia e Dados
  { verticalKey: "tecnologia", areaKey: "tecnologia", indicatorName: "Nível de integração", kind: "nivel", value: 100, label: "100% (integração de sistemas)" },
  { verticalKey: "tecnologia", areaKey: "tecnologia", indicatorName: "% processos digitalizados", kind: "delta", value: null, label: "-60% (redução de processos manuais)" },
  { verticalKey: "tecnologia", areaKey: "tecnologia", indicatorName: "Erros de informação", kind: "delta", value: null, label: "-50% (redução de erros operacionais)" },

  // Fiscal, Jurídico e Compliance
  { verticalKey: "fiscal_juridico", areaKey: "fiscal", indicatorName: "Débitos fiscais", kind: "delta", value: null, label: "-80% (redução de riscos)" },
  { verticalKey: "fiscal_juridico", areaKey: "fiscal", indicatorName: "Carga tributária efetiva", kind: "delta", value: null, label: "+15% de economia fiscal anual" },
];

export function suggestionsForVertical(verticalKey: string): KpiTargetSuggestion[] {
  return KPI_TARGET_SUGGESTIONS.filter((s) => s.verticalKey === verticalKey);
}
