import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { SparklesIcon } from "@/app/components/icons";

type Agent = {
  name: string;
  description: string;
  status: "ativo" | "planejado";
  requiresGemini?: boolean;
  seeItAt?: { href: string; label: string };
};

type AgentGroup = {
  title: string;
  purpose: string;
  agents: Agent[];
};

const GROUPS: AgentGroup[] = [
  {
    title: "Grupo 1 · Agentes de Diagnóstico",
    purpose: "Analisam as respostas do questionário e apoiam o relatório.",
    agents: [
      {
        name: "Agente de Diagnóstico Consultivo",
        description:
          "Lê as notas e gaps de cada área e escreve o sumário executivo, a causa raiz e a recomendação da Arca por área (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/relatorios", label: "Ver no relatório" },
      },
      {
        name: "Agente de Diagnóstico Financeiro / Comercial / Fiscal / RH / Tecnologia",
        description:
          "Aprofunda a análise de cada uma das 5 verticais cruzando as respostas do questionário (evidências, responsável, impacto/urgência/risco) com o conteúdo real dos documentos do Data Room categorizados naquela área — sem integração bancária ou contábil externa, só o que já está no diagnóstico e no Data Room (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/relatorios", label: "Ver em Agentes Especialistas no relatório" },
      },
    ],
  },
  {
    title: "Grupo 2 · Agentes Operacionais",
    purpose: "Executam atividades repetitivas, sempre com revisão humana.",
    agents: [
      {
        name: "Classificador de documentos do Data Room",
        description:
          "Lê o conteúdo de PDFs e arquivos de texto enviados e sugere o tipo do documento (extrato, DRE, contrato, nota fiscal...) com um nível de confiança. Foto e PDF escaneado agora são lidos por OCR direto no Gemini (multimodal) — só quando o formato realmente não dá pra ler (planilha, Office) classifica pelo nome do arquivo e marca confiança baixa.",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/empresas", label: "Ver no Data Room de uma empresa" },
      },
      {
        name: "Gerador de ata de reunião",
        description:
          "Organiza anotações brutas de reunião (coladas ou digitadas manualmente — sem integração de calendário ou transcrição de áudio) em resumo, decisões e pendências (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/empresas", label: "Ver em Atas de Reunião de uma empresa" },
      },
      {
        name: "Agente de Extração Financeira",
        description:
          "Sob demanda (botão \"Analisar transações\"), lê um extrato bancário classificado no Data Room — texto ou OCR direto na imagem/PDF — e extrai cada transação com data, valor e categoria (fornecedor, imposto, despesa pessoal, empréstimo), sinalizando o que parece inconsistente. Fica pendente até um humano confirmar ou rejeitar, transação por transação (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/empresas", label: "Ver no Data Room de uma empresa" },
      },
    ],
  },
  {
    title: "Grupo 3 · Agentes de Projetos",
    purpose: "Acompanham a execução do plano de ação (Kanban).",
    agents: [
      {
        name: "Agente PMO",
        description:
          "Verifica todas as ações abertas do board e aponta as que estão com prazo vencido ou sem responsável definido — regra de negócio, roda em toda visita ao Kanban.",
        status: "ativo",
        seeItAt: { href: "/empresas", label: "Ver no Kanban de um projeto" },
      },
      {
        name: "Agente de Relatório de Sprint",
        description:
          "Lê o histórico de movimentações do Kanban nos últimos 30 dias e escreve um resumo do progresso para o comitê de gestão (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/empresas", label: "Ver no Kanban de um projeto" },
      },
      {
        name: "Agente Scrum Master",
        description:
          "Verifica sprints atrasados (passaram do prazo sem 100% concluído), sprints sem nenhuma ação atribuída e ações paradas há mais de 14 dias — regra de negócio, roda em toda visita ao Kanban.",
        status: "ativo",
        seeItAt: { href: "/empresas", label: "Ver no Kanban de um projeto" },
      },
    ],
  },
  {
    title: "Grupo 4 · Agentes de Performance Contínua",
    purpose: "Comparam a evolução do negócio entre diagnósticos e ao longo do tempo.",
    agents: [
      {
        name: "Agente de Evolução de Maturidade",
        description:
          "Compara a nota geral e por área entre os dois diagnósticos mais recentes da mesma empresa e explica o que mudou (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/empresas", label: "Ver no cockpit da empresa" },
      },
      {
        name: "Agente de Performance por Área",
        description:
          "Lê o histórico de indicadores do Cockpit de Performance (Financeiro, Comercial, Marketing...) e narra tendências — um agente genérico por área em vez de um agente fixo por indicador, cobrindo Resultado Financeiro/Performance Comercial/Margem/Produtividade do plano original (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/empresas", label: "Ver em Indicadores de uma empresa" },
      },
      {
        name: "Agente de Alertas Estratégicos",
        description:
          "Compara o valor mais recente de cada indicador com o mês anterior e sinaliza queda ou alta acima de 15% — regra de negócio, sem IA, sem depender de narrativa.",
        status: "ativo",
        seeItAt: { href: "/empresas", label: "Ver em Indicadores de uma empresa" },
      },
    ],
  },
  {
    title: "Grupo 5 · Agentes de Governança e Qualidade",
    purpose: "Protegem a Arca e o cliente de erro de IA ou decisão sem base.",
    agents: [
      {
        name: "Agente de Auditoria de Evidências",
        description:
          "Verifica se cada resposta crítica (nota ≤ 2) tem evidência anexada antes de entrar no relatório final — regra de negócio, roda em toda geração de relatório.",
        status: "ativo",
        seeItAt: { href: "/relatorios", label: "Ver no relatório" },
      },
      {
        name: "Agente de Qualidade de Dados",
        description:
          "Varre todas as empresas da plataforma (não uma só) atrás de lacuna estrutural — diagnóstico concluído sem nenhuma evidência, notas todas zeradas (indício de dado de teste), ações em massa sem responsável — regra de negócio, roda em toda visita à central de relatórios.",
        status: "ativo",
        seeItAt: { href: "/relatorios", label: "Ver em Relatórios" },
      },
      {
        name: "Agente de Risco Fiscal",
        description:
          "Sinaliza nota crítica/frágil nas perguntas fiscais que indicam exposição concreta — débito em aberto, certidão vencida, classificação incorreta, passivo não mapeado — regra de negócio, roda em toda geração de relatório.",
        status: "ativo",
        seeItAt: { href: "/relatorios", label: "Ver no relatório" },
      },
      {
        name: "Agente de Risco Trabalhista",
        description:
          "Mesma lógica nas perguntas de Pessoas e Jurídico que apontam exposição trabalhista direta — regra de negócio, roda em toda geração de relatório.",
        status: "ativo",
        seeItAt: { href: "/relatorios", label: "Ver no relatório" },
      },
      {
        name: "Agente de Conformidade Contratual",
        description:
          "Verifica as perguntas jurídicas sobre contratos, licenças e exposição a multas/processos — regra de negócio, roda em toda geração de relatório.",
        status: "ativo",
        seeItAt: { href: "/relatorios", label: "Ver no relatório" },
      },
      {
        name: "Agente LGPD",
        description:
          "Cruza a pergunta jurídica sobre política de proteção de dados com documentos sensíveis (folha de pagamento) já no Data Room — não há registro de consentimento na plataforma, então o agente sinaliza pra confirmação manual em vez de presumir conformidade — regra de negócio, roda em toda geração de relatório.",
        status: "ativo",
        seeItAt: { href: "/relatorios", label: "Ver no relatório" },
      },
    ],
  },
];

export default function AgentesPage() {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <SparklesIcon className="w-4 h-4" />
            ArcaOS
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Central de Agentes de IA</h1>
          <p className="text-slate-600">
            Roadmap dos agentes previstos no plano estratégico da Arca. Marcados como{" "}
            <span className="font-semibold text-green-700">Ativo</span> os que já estão de fato
            ligados nesta versão do produto; os demais são{" "}
            <span className="font-semibold text-slate-500">planejados</span> para as próximas fases.
          </p>
        </Card>

        {GROUPS.map((group) => (
          <Card key={group.title}>
            <h2 className="text-lg font-bold text-slate-900">{group.title}</h2>
            <p className="text-sm text-slate-500 mb-4">{group.purpose}</p>
            <div className="space-y-3">
              {group.agents.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{agent.name}</p>
                    <p className="text-sm text-slate-600">{agent.description}</p>
                    {agent.status === "ativo" && agent.seeItAt && (
                      <Link
                        href={agent.seeItAt.href}
                        className="inline-block mt-1.5 text-xs font-medium text-blue-700 hover:underline"
                      >
                        {agent.seeItAt.label} →
                      </Link>
                    )}
                  </div>
                  <div className="shrink-0">
                    <Badge
                      text={
                        agent.status === "ativo"
                          ? agent.requiresGemini && !hasGeminiKey
                            ? "Ativo (sem chave configurada)"
                            : "Ativo"
                          : "Planejado"
                      }
                      tone={agent.status === "ativo" ? "good" : "neutral"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
