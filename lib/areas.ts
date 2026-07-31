export type Question = {
  id: string;
  text: string;
};

export type Area = {
  key: string;
  name: string;
  objective: string;
  indicators: string[];
  questions: Question[];
};

export const AREAS: Area[] = [
  {
    key: "estrategia",
    name: "Direção, Estratégia e Governança",
    objective: "Entender se a empresa tem clareza de rumo, metas e governança.",
    indicators: [
      "Crescimento mensal",
      "Margem EBITDA",
      "Geração de caixa",
      "% metas atingidas",
      "Valuation estimado",
      "Nível de dependência do dono",
    ],
    questions: [
      { id: "q1", text: "A empresa possui planejamento estratégico formal para os próximos 12, 24 ou 36 meses?" },
      { id: "q2", text: "Existem metas claras de faturamento, lucro, clientes, expansão e produtividade?" },
      { id: "q3", text: "Os sócios e líderes acompanham indicadores em reuniões periódicas?" },
      { id: "q4", text: "A empresa possui organograma definido?" },
      { id: "q5", text: "Existe clareza sobre papéis, responsabilidades e poder de decisão?" },
      { id: "q6", text: "A empresa possui política de alçadas para compras, descontos, contratações e pagamentos?" },
      { id: "q7", text: "Existe separação clara entre finanças pessoais dos sócios e finanças da empresa?" },
      { id: "q8", text: "A empresa possui reuniões de gestão com pauta, ata e responsáveis?" },
      { id: "q9", text: "Existem riscos estratégicos mapeados?" },
      { id: "q10", text: "A empresa tem um plano de crescimento ou depende apenas da demanda espontânea?" },
    ],
  },
  {
    key: "financeiro",
    name: "Financeiro e Controladoria",
    objective: "Avaliar caixa, rentabilidade, custos, dívidas, previsibilidade e qualidade da gestão financeira.",
    indicators: [
      "Receita mensal",
      "Margem bruta",
      "EBITDA",
      "Lucro líquido",
      "Caixa disponível",
      "Ciclo financeiro",
      "Inadimplência",
      "Endividamento",
      "Ponto de equilíbrio",
      "Custo fixo sobre receita",
    ],
    questions: [
      { id: "q1", text: "A empresa possui DRE mensal gerencial?" },
      { id: "q2", text: "Existe fluxo de caixa projetado para pelo menos 90 dias?" },
      { id: "q3", text: "A empresa conhece sua margem bruta por produto ou serviço?" },
      { id: "q4", text: "A empresa conhece seu ponto de equilíbrio?" },
      { id: "q5", text: "As contas a pagar e a receber são controladas diariamente?" },
      { id: "q6", text: "Existe conciliação bancária regular?" },
      { id: "q7", text: "A empresa separa custo fixo, custo variável, despesa e investimento?" },
      { id: "q8", text: "Existe controle de inadimplência?" },
      { id: "q9", text: "Existem dívidas mapeadas por valor, taxa, vencimento e garantia?" },
      { id: "q10", text: "A precificação considera impostos, custos, margem e comissões?" },
      { id: "q11", text: "Os sócios fazem retirada planejada ou retiram conforme disponibilidade de caixa?" },
      { id: "q12", text: "Existe orçamento anual aprovado?" },
    ],
  },
  {
    key: "comercial",
    name: "Comercial e Vendas",
    objective: "Avaliar geração de receita, funil, metas, canais e produtividade comercial.",
    indicators: [
      "Leads gerados",
      "Taxa de conversão",
      "Ticket médio",
      "Receita por vendedor",
      "CAC",
      "LTV",
      "Tempo médio de fechamento",
      "Vendas por canal",
      "Churn/cancelamento",
      "Receita recorrente",
    ],
    questions: [
      { id: "q1", text: "A empresa possui meta comercial mensal por vendedor, canal ou região?" },
      { id: "q2", text: "Existe funil de vendas estruturado?" },
      { id: "q3", text: "A empresa mede leads, propostas, conversão e ticket médio?" },
      { id: "q4", text: "Existe CRM ou controle equivalente?" },
      { id: "q5", text: "O time comercial possui script, playbook ou padrão de abordagem?" },
      { id: "q6", text: "Existe política de comissão clara?" },
      { id: "q7", text: "A empresa mede CAC, LTV ou retorno das campanhas comerciais?" },
      { id: "q8", text: "Existem canais ativos de venda: indicação, parceiros, digital, outbound, loja, representantes?" },
      { id: "q9", text: "Existe rotina semanal de acompanhamento comercial?" },
      { id: "q10", text: "A empresa sabe quais produtos ou serviços são mais rentáveis?" },
      { id: "q11", text: "Existe estratégia de upsell, cross-sell ou recompra?" },
      { id: "q12", text: "Existe análise dos motivos de perda de venda?" },
    ],
  },
  {
    key: "marketing",
    name: "Marketing e Posicionamento",
    objective: "Avaliar marca, comunicação, autoridade e geração de demanda.",
    indicators: [
      "Leads por campanha",
      "Custo por lead",
      "Custo por aquisição",
      "Conversão por canal",
      "Alcance",
      "Engajamento",
      "Vendas originadas do marketing",
    ],
    questions: [
      { id: "q1", text: "A empresa possui posicionamento claro no mercado?" },
      { id: "q2", text: "Existe definição de público-alvo ou persona?" },
      { id: "q3", text: "A empresa tem calendário de conteúdo?" },
      { id: "q4", text: "Existe presença ativa em redes sociais, Google, site ou landing pages?" },
      { id: "q5", text: "A empresa mede o retorno das campanhas?" },
      { id: "q6", text: "Existe padrão visual e linguagem de marca?" },
      { id: "q7", text: "A empresa possui ofertas bem definidas?" },
      { id: "q8", text: "Existe estratégia de tráfego pago ou mídia local?" },
      { id: "q9", text: "A empresa coleta depoimentos, cases ou provas sociais?" },
      { id: "q10", text: "Existe integração entre marketing e vendas?" },
      { id: "q11", text: "A empresa sabe quais campanhas geram clientes reais?" },
      { id: "q12", text: "Existe planejamento de lançamento, promoções ou campanhas sazonais?" },
    ],
  },
  {
    key: "operacoes",
    name: "Operações, Produção e Entrega",
    objective: "Avaliar capacidade, produtividade, qualidade, gargalos e padronização da entrega.",
    indicators: [
      "Produtividade por colaborador",
      "Prazo médio de entrega",
      "Retrabalho",
      "Capacidade utilizada",
      "Custo operacional",
      "Ocupação",
      "SLA",
      "Qualidade percebida",
    ],
    questions: [
      { id: "q1", text: "A empresa possui processos operacionais documentados?" },
      { id: "q2", text: "Existem indicadores de produtividade por equipe ou colaborador?" },
      { id: "q3", text: "A empresa mede prazo de entrega ou tempo de atendimento?" },
      { id: "q4", text: "Existem padrões de qualidade definidos?" },
      { id: "q5", text: "Os gargalos operacionais são conhecidos?" },
      { id: "q6", text: "Existe controle de retrabalho?" },
      { id: "q7", text: "A empresa conhece sua capacidade instalada?" },
      { id: "q8", text: "Existe programação diária, semanal ou mensal da operação?" },
      { id: "q9", text: "A operação depende excessivamente do dono ou de pessoas-chave?" },
      { id: "q10", text: "Existe controle de estoque, insumos ou recursos necessários para entrega?" },
      { id: "q11", text: "Existe rotina de auditoria ou conferência da qualidade?" },
      { id: "q12", text: "Existem planos de contingência para falhas operacionais?" },
    ],
  },
  {
    key: "atendimento",
    name: "Atendimento, Sucesso do Cliente e Pós-venda",
    objective: "Avaliar retenção, satisfação, experiência e recorrência.",
    indicators: [
      "NPS",
      "Reclamações",
      "Tempo médio de resposta",
      "Taxa de resolução",
      "Churn",
      "Recompra",
      "Indicações",
      "Receita por cliente ativo",
    ],
    questions: [
      { id: "q1", text: "A empresa mede satisfação do cliente?" },
      { id: "q2", text: "Existe NPS ou pesquisa pós-atendimento?" },
      { id: "q3", text: "Existem canais formais de atendimento?" },
      { id: "q4", text: "Existe SLA de resposta?" },
      { id: "q5", text: "As reclamações são registradas e analisadas?" },
      { id: "q6", text: "Existe rotina de pós-venda?" },
      { id: "q7", text: "A empresa possui estratégia de retenção?" },
      { id: "q8", text: "Existe análise de clientes perdidos?" },
      { id: "q9", text: "Existem scripts ou padrões de atendimento?" },
      { id: "q10", text: "A empresa mede recompra ou recorrência?" },
      { id: "q11", text: "Existe base de clientes organizada?" },
      { id: "q12", text: "O atendimento gera oportunidades comerciais?" },
    ],
  },
  {
    key: "pessoas",
    name: "Pessoas, RH e Cultura",
    objective: "Avaliar estrutura humana, liderança, produtividade, clima e desenvolvimento.",
    indicators: [
      "Turnover",
      "Absenteísmo",
      "Produtividade por pessoa",
      "Custo de pessoal sobre receita",
      "Atingimento de metas",
      "Horas de treinamento",
      "Clima organizacional",
    ],
    questions: [
      { id: "q1", text: "Existe organograma atualizado?" },
      { id: "q2", text: "Cada colaborador possui função e responsabilidade definidas?" },
      { id: "q3", text: "Existem descrições de cargos?" },
      { id: "q4", text: "A empresa possui processo de contratação estruturado?" },
      { id: "q5", text: "Existe integração/onboarding de novos colaboradores?" },
      { id: "q6", text: "Existem metas individuais ou por equipe?" },
      { id: "q7", text: "Existe avaliação de desempenho?" },
      { id: "q8", text: "Existe política de remuneração, bônus ou comissão?" },
      { id: "q9", text: "A empresa possui plano de treinamento?" },
      { id: "q10", text: "Existe pesquisa de clima ou feedback estruturado?" },
      { id: "q11", text: "A liderança acompanha produtividade e comportamento?" },
      { id: "q12", text: "Existem riscos trabalhistas relevantes?" },
    ],
  },
  {
    key: "tecnologia",
    name: "Tecnologia, Sistemas e Dados",
    objective: "Avaliar uso de sistemas, automação, confiabilidade dos dados e maturidade digital.",
    indicators: [
      "% processos digitalizados",
      "% relatórios automatizados",
      "Tempo para fechamento gerencial",
      "Erros de informação",
      "Aderência ao uso do sistema",
      "Nível de integração",
    ],
    questions: [
      { id: "q1", text: "A empresa possui ERP ou sistema central de gestão?" },
      { id: "q2", text: "As áreas usam sistemas integrados ou planilhas isoladas?" },
      { id: "q3", text: "A empresa possui CRM?" },
      { id: "q4", text: "Os dados financeiros, comerciais e operacionais são confiáveis?" },
      { id: "q5", text: "Existem dashboards ou relatórios automáticos?" },
      { id: "q6", text: "Existe controle de acesso por usuário?" },
      { id: "q7", text: "A empresa possui política de backup?" },
      { id: "q8", text: "Existem automações em processos repetitivos?" },
      { id: "q9", text: "Os gestores conseguem tomar decisão com dados atualizados?" },
      { id: "q10", text: "Existe integração entre financeiro, vendas, estoque e operação?" },
      { id: "q11", text: "A empresa usa inteligência artificial ou automação no atendimento, vendas ou gestão?" },
      { id: "q12", text: "Existe risco relevante de perda de dados ou dependência de uma única pessoa?" },
    ],
  },
  {
    key: "fiscal",
    name: "Fiscal, Tributário e Contábil",
    objective: "Avaliar regime tributário, conformidade, risco fiscal e qualidade das informações contábeis.",
    indicators: [
      "Carga tributária efetiva",
      "Débitos fiscais",
      "Multas/juros",
      "Prazo de entrega contábil",
      "Certidões",
      "Risco tributário",
    ],
    questions: [
      { id: "q1", text: "A empresa sabe se está no regime tributário mais adequado?" },
      { id: "q2", text: "Existe acompanhamento mensal de impostos?" },
      { id: "q3", text: "A contabilidade entrega relatórios gerenciais ou apenas obrigações fiscais?" },
      { id: "q4", text: "Existem débitos fiscais em aberto?" },
      { id: "q5", text: "A empresa possui certidões negativas atualizadas?" },
      { id: "q6", text: "Existe controle de notas fiscais emitidas e recebidas?" },
      { id: "q7", text: "A empresa entende a carga tributária por produto ou serviço?" },
      { id: "q8", text: "Existe risco de classificação fiscal incorreta?" },
      { id: "q9", text: "O pró-labore e a distribuição de lucros estão formalizados?" },
      { id: "q10", text: "Existem contratos entre empresas relacionadas, quando aplicável?" },
      { id: "q11", text: "Existe planejamento tributário lícito e documentado?" },
      { id: "q12", text: "A empresa possui passivos fiscais mapeados?" },
    ],
  },
  {
    key: "juridico",
    name: "Jurídico, Contratos e Compliance",
    objective: "Avaliar proteção jurídica, contratos, riscos e governança documental.",
    indicators: [
      "Contratos formalizados",
      "Processos em aberto",
      "Risco jurídico estimado",
      "Documentos vencidos",
      "Grau de proteção societária",
      "Aderência LGPD",
    ],
    questions: [
      { id: "q1", text: "A empresa possui contratos padrão com clientes?" },
      { id: "q2", text: "Os contratos com fornecedores estão formalizados?" },
      { id: "q3", text: "Existem contratos de trabalho, prestação de serviço ou parceria bem definidos?" },
      { id: "q4", text: "A empresa possui acordo de sócios, quando aplicável?" },
      { id: "q5", text: "Existem riscos judiciais em aberto?" },
      { id: "q6", text: "A empresa possui política de LGPD ou proteção de dados?" },
      { id: "q7", text: "A marca está registrada ou em processo de registro?" },
      { id: "q8", text: "Existem cláusulas de confidencialidade e não concorrência quando necessárias?" },
      { id: "q9", text: "A empresa possui controle de vencimento de contratos?" },
      { id: "q10", text: "Existem licenças, alvarás ou autorizações obrigatórias?" },
      { id: "q11", text: "Existe exposição relevante a multas, notificações ou processos?" },
      { id: "q12", text: "A empresa possui governança documental?" },
    ],
  },
  {
    key: "compras",
    name: "Compras, Fornecedores e Estoque",
    objective: "Avaliar custo, negociação, dependência de fornecedores e capital parado.",
    indicators: [
      "Giro de estoque",
      "Estoque parado",
      "Prazo médio de pagamento",
      "Economia em compras",
      "Dependência de fornecedor",
      "Ruptura de estoque",
    ],
    questions: [
      { id: "q1", text: "A empresa possui política de compras?" },
      { id: "q2", text: "Existem cotações mínimas antes de compras relevantes?" },
      { id: "q3", text: "Há controle de estoque ou insumos?" },
      { id: "q4", text: "A empresa mede giro de estoque?" },
      { id: "q5", text: "Existem fornecedores críticos sem alternativa?" },
      { id: "q6", text: "Existem contratos ou acordos comerciais com fornecedores principais?" },
      { id: "q7", text: "A empresa sabe quais itens têm maior impacto no custo?" },
      { id: "q8", text: "Existe controle de perdas, vencimentos ou obsolescência?" },
      { id: "q9", text: "As compras são planejadas ou feitas de forma emergencial?" },
      { id: "q10", text: "Existe aprovação por alçada?" },
      { id: "q11", text: "A empresa negocia prazo, preço e condição de pagamento?" },
      { id: "q12", text: "Existe capital parado em estoque excessivo?" },
    ],
  },
  {
    key: "indicadores",
    name: "Indicadores, Reuniões e Gestão da Rotina",
    objective: "Avaliar a disciplina de execução.",
    indicators: [
      "% ações concluídas no prazo",
      "% metas atingidas",
      "Quantidade de reuniões realizadas",
      "Tempo médio de resolução",
      "Evolução da maturidade por área",
    ],
    questions: [
      { id: "q1", text: "A empresa possui painel de indicadores?" },
      { id: "q2", text: "Os indicadores são acompanhados semanal ou mensalmente?" },
      { id: "q3", text: "Cada indicador tem responsável?" },
      { id: "q4", text: "Existem metas por área?" },
      { id: "q5", text: "Existe reunião de resultado com frequência definida?" },
      { id: "q6", text: "As decisões são registradas em plano de ação?" },
      { id: "q7", text: "Os planos de ação têm prazo e dono?" },
      { id: "q8", text: "Existe acompanhamento das pendências?" },
      { id: "q9", text: "A empresa aprende com erros e revisa processos?" },
      { id: "q10", text: "Existe rotina de melhoria contínua?" },
      { id: "q11", text: "Os líderes sabem interpretar os números?" },
      { id: "q12", text: "A empresa usa dados para decidir ou decide pela intuição?" },
    ],
  },
];

export const OBJECTIVES = [
  "Crescer faturamento",
  "Melhorar lucro",
  "Organizar gestão",
  "Reduzir custos",
  "Preparar venda/valuation",
  "Profissionalizar time",
  "Implantar controles",
  "Melhorar comercial",
  "Corrigir crise financeira",
  "Preparar sucessão ou expansão",
];

export function getAreaByKey(key: string): Area | undefined {
  return AREAS.find((a) => a.key === key);
}

export function getAreaIndex(key: string): number {
  return AREAS.findIndex((a) => a.key === key);
}

// Where "Continuar" should take the user: the first area whose questions have
// not all been answered yet. Falls back to the first area when nothing has
// been answered (a fresh diagnostic), and to the last area when everything is
// already complete. Never returns an empty key — that would produce a 404.
export function getResumeAreaKey(answers: { areaKey: string }[]): string {
  const answeredCount = new Map<string, number>();
  for (const answer of answers) {
    answeredCount.set(answer.areaKey, (answeredCount.get(answer.areaKey) ?? 0) + 1);
  }
  const next = AREAS.find(
    (area) => (answeredCount.get(area.key) ?? 0) < area.questions.length
  );
  return next ? next.key : AREAS[AREAS.length - 1].key;
}

// The 5 areas covered by the Agente de Diagnóstico Vertical (Financeiro /
// Comercial / Fiscal / RH / Tecnologia) — a deliberate subset, not all 12.
export const VERTICAL_AGENT_AREAS = ["financeiro", "comercial", "fiscal", "pessoas", "tecnologia"] as const;
