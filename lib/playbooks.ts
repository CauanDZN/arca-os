// Playbook de Execução por vertical — o conteúdo que faltava por trás do
// Kanban (plano estratégico, "Nível 2 · Execução" de cada vertical, seção
// "Ferramentas Oficiais Arca BTO" → Playbooks). Hoje o plano de ação só nasce
// de perguntas fracas do diagnóstico; o playbook é o passo a passo padrão de
// implantação da vertical, independente de qualquer nota — a mesma vertical
// para dois clientes diferentes recebe o mesmo playbook.
export type Playbook = {
  verticalKey: string;
  summary: string;
  steps: string[];
};

export const PLAYBOOKS: Playbook[] = [
  {
    verticalKey: "estrategia",
    summary: "Criação do modelo de governança, papéis, regimento interno e calendário de decisão.",
    steps: [
      "Criar o modelo de governança e as alçadas de decisão",
      "Definir responsáveis (RACI) para as principais decisões",
      "Formalizar regimento interno das reuniões de gestão",
      "Montar calendário de governança (frequência das reuniões de resultado)",
      "Implantar dashboard executivo de acompanhamento",
      "Redigir política básica de compliance",
    ],
  },
  {
    verticalKey: "financeiro",
    summary: "Implantação de fluxo de caixa, padronização de contas a pagar/receber e relatórios mensais.",
    steps: [
      "Implantar fluxo de caixa projetado para pelo menos 90 dias",
      "Padronizar o processo de contas a pagar",
      "Padronizar o processo de contas a receber",
      "Criar centros de custo",
      "Estruturar o DRE gerencial mensal",
    ],
  },
  {
    verticalKey: "comercial",
    summary: "Criação do funil, implantação de CRM, scripts, metas, comissões e rotina de acompanhamento.",
    steps: [
      "Estruturar o funil de vendas por etapa",
      "Implantar CRM ou controle equivalente",
      "Criar scripts e playbook de abordagem comercial",
      "Definir metas por vendedor, canal ou região",
      "Formalizar política de comissão",
      "Implantar rotina semanal de acompanhamento comercial",
      "Treinar a equipe no novo processo",
    ],
  },
  {
    verticalKey: "marketing",
    summary: "Plano de marketing, posicionamento, produção de conteúdo, tráfego pago e site.",
    steps: [
      "Definir posicionamento e público-alvo",
      "Criar plano de marketing com calendário de conteúdo",
      "Estruturar site ou landing pages",
      "Lançar campanhas de tráfego pago",
      "Padronizar identidade visual e linguagem de marca",
      "Estruturar mensuração de retorno por campanha",
    ],
  },
  {
    verticalKey: "operacoes",
    summary: "Padronização de processos, indicadores de produtividade e política de compras.",
    steps: [
      "Documentar os processos operacionais principais",
      "Definir indicadores de produtividade por equipe",
      "Mapear os gargalos operacionais conhecidos",
      "Implantar política de compras com cotação mínima",
      "Estruturar controle de estoque e insumos",
      "Criar plano de contingência para falhas operacionais",
    ],
  },
  {
    verticalKey: "pessoas",
    summary: "Organograma, cargos e salários, R&S, onboarding e rotina de feedback.",
    steps: [
      "Criar ou atualizar o organograma",
      "Estruturar plano de cargos e salários",
      "Formalizar políticas internas de RH",
      "Padronizar o processo de recrutamento e seleção",
      "Implantar onboarding de novos colaboradores",
      "Criar rotina periódica de feedback e avaliação de desempenho",
    ],
  },
  {
    verticalKey: "tecnologia",
    summary: "Implantação de sistemas, automações, integração entre áreas e adoção pelos usuários.",
    steps: [
      "Selecionar e implantar sistema central (ERP ou equivalente)",
      "Automatizar os processos repetitivos identificados",
      "Integrar dados entre financeiro, comercial e operação",
      "Treinar os usuários no novo sistema",
      "Implantar política de backup e controle de acesso",
      "Acompanhar a adoção nas primeiras semanas",
    ],
  },
  {
    verticalKey: "fiscal_juridico",
    summary: "Escrituração contábil, rotinas de fechamento, controles internos e contratos formalizados.",
    steps: [
      "Regularizar escrituração contábil e obrigações fiscais em atraso",
      "Estruturar rotina mensal de fechamento contábil",
      "Levantar e formalizar certidões negativas",
      "Padronizar contratos com clientes e fornecedores",
      "Mapear vencimento de licenças, alvarás e contratos",
      "Redigir política básica de LGPD",
    ],
  },
  {
    verticalKey: "gestao_rotina",
    summary: "Painel de indicadores, calendário de reuniões e disciplina de plano de ação.",
    steps: [
      "Implantar painel de indicadores por área",
      "Definir um responsável por indicador",
      "Criar calendário fixo de reuniões de resultado",
      "Formalizar plano de ação com prazo e dono em cada reunião",
      "Estruturar rotina de acompanhamento de pendências",
    ],
  },
];

export function getPlaybookByVertical(verticalKey: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.verticalKey === verticalKey);
}
