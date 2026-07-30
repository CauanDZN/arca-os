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
        description: "Agentes especializados por vertical, com leitura de evidências e documentos do Data Room.",
        status: "planejado",
      },
    ],
  },
  {
    title: "Grupo 2 · Agentes Operacionais",
    purpose: "Executam atividades repetitivas, sempre com revisão humana.",
    agents: [
      {
        name: "Classificador de documentos do Data Room",
        description: "Identifica automaticamente o tipo de documento enviado (extrato, DRE, contrato) e sugere a categoria.",
        status: "planejado",
      },
      {
        name: "Gerador de ata de reunião",
        description: "Resume decisões e pendências a partir de notas de reunião.",
        status: "planejado",
      },
    ],
  },
  {
    title: "Grupo 3 · Agentes de Projetos",
    purpose: "Acompanham a execução do plano de ação (Kanban).",
    agents: [
      {
        name: "Agente PMO",
        description: "Analisa o board de execução e aponta ações atrasadas ou sem responsável.",
        status: "planejado",
      },
      {
        name: "Agente de Relatório de Sprint",
        description: "Gera resumo periódico do progresso do projeto para o comitê de gestão.",
        status: "planejado",
      },
    ],
  },
  {
    title: "Grupo 4 · Agentes de Performance Contínua",
    purpose: "Comparam a evolução do negócio entre diagnósticos.",
    agents: [
      {
        name: "Agente de Evolução de Maturidade",
        description:
          "Compara a nota geral e por área entre os dois diagnósticos mais recentes da mesma empresa e explica o que mudou (via Gemini).",
        status: "ativo",
        requiresGemini: true,
        seeItAt: { href: "/empresas", label: "Ver no cockpit da empresa" },
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
    ],
  },
];

export default function AgentesPage() {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/empresas" className="text-sm text-slate-500 hover:text-slate-800">
          ← Empresas
        </Link>

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
                  <div>
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
