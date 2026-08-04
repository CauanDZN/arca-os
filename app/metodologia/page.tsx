import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { CompassIcon, SparklesIcon, TrendingUpIcon } from "@/app/components/icons";

type Principle = { title: string; description: string };

const PRINCIPLES: Principle[] = [
  {
    title: "1. Diagnosticar com profundidade",
    description:
      "Entender causas, não sintomas — o questionário de 12 áreas pede evidência, responsável, impacto, urgência e risco por pergunta, e o relatório separa causa raiz de recomendação em vez de só apontar uma nota baixa.",
  },
  {
    title: "2. Planejar com foco em execução",
    description:
      "Metas práticas, responsáveis claros — todo item do plano de ação vira uma tarefa com responsável, prazo e indicador de sucesso antes de entrar no Kanban, não uma lista solta de recomendações.",
  },
  {
    title: "3. Executar com excelência",
    description:
      "Times atuando dentro da empresa — o Playbook de Execução por vertical entra como um épico próprio no Kanban, com o passo a passo padrão de implantação da vertical, separado do plano que vem das respostas fracas do diagnóstico.",
  },
  {
    title: "4. Mensurar continuamente",
    description:
      "Gestão baseada em dados — o Cockpit de Performance acompanha indicadores mês a mês contra as metas do plano estratégico, e o Comitê de Gestão recebe um scorecard automático todo mês.",
  },
  {
    title: "5. Transformar de forma sustentável",
    description:
      "Cultura de melhoria contínua — cada novo diagnóstico compara a evolução de maturidade com o anterior e reabre o ciclo, em vez de tratar a transformação como um projeto com fim marcado.",
  },
];

type CycleStep = {
  step: number;
  title: string;
  planDescription: string;
  implementation: string;
  href: string;
  linkLabel: string;
};

const CYCLE: CycleStep[] = [
  {
    step: 1,
    title: "Diagnóstico Estratégico",
    planDescription: "Assessment 360° de todas as áreas + mapa de prioridades",
    implementation: "Arca Checkup — questionário de 12 áreas, motor de maturidade Nível 1–5",
    href: "/empresas",
    linkLabel: "Ver empresas e diagnósticos →",
  },
  {
    step: 2,
    title: "Plano de Ação",
    planDescription: "Roadmap priorizado + OKRs + Quick Wins",
    implementation: "Matriz de priorização e plano de ação 30/90/365 dias no relatório executivo",
    href: "/relatorios",
    linkLabel: "Ver relatórios →",
  },
  {
    step: 3,
    title: "Execução & Implantação",
    planDescription: "Atuação das verticais + implantação de rotinas",
    implementation: "Arca Planner — Kanban com sprints e épicos, incluindo o Playbook de Execução por vertical",
    href: "/empresas",
    linkLabel: "Ver empresas →",
  },
  {
    step: 4,
    title: "Monitoramento",
    planDescription: "Arca Dashboard + reuniões executivas",
    implementation: "Arca Dashboard e Cockpit de Performance, com relatório mensal automático pro Comitê de Gestão",
    href: "/dashboard",
    linkLabel: "Ver Arca Dashboard →",
  },
  {
    step: 5,
    title: "Transformação Contínua",
    planDescription: "Evolução de maturidade + expansão de escopo",
    implementation: "Agente de Evolução de Maturidade compara diagnósticos; Catálogo Comercial expande pra novas verticais",
    href: "/agentes",
    linkLabel: "Ver Agentes de IA →",
  },
];

type Tool = { name: string; description: string; status: "ativo" | "vitrine"; href: string; linkLabel: string };

const TOOLS: Tool[] = [
  {
    name: "Arca Checkup",
    description: "Diagnóstico inicial em plataforma digital — completo (140 perguntas) ou por vertical isolada.",
    status: "ativo",
    href: "/empresas",
    linkLabel: "Iniciar diagnóstico →",
  },
  {
    name: "Arca Planner",
    description: "Estruturação do plano de ação e metas — Kanban com sprints, épicos e o Playbook de Execução.",
    status: "ativo",
    href: "/empresas",
    linkLabel: "Ver projetos →",
  },
  {
    name: "Arca Dashboard",
    description: "Acompanhamento de resultados e KPIs — carteira inteira ou uma empresa, conforme o papel.",
    status: "ativo",
    href: "/dashboard",
    linkLabel: "Abrir Arca Dashboard →",
  },
  {
    name: "Arca Manual BTO",
    description:
      "Guia operacional e processos padrão — esta própria página: a metodologia, o ciclo e o link pra onde cada etapa vive no produto, em vez de um PDF separado que ficaria desatualizado.",
    status: "vitrine",
    href: "/metodologia",
    linkLabel: "Você está aqui",
  },
  {
    name: "Playbooks",
    description: "Padrão de entrega por vertical especializada — passo a passo igual pra qualquer cliente da mesma vertical, independente da nota do diagnóstico.",
    status: "ativo",
    href: "/empresas",
    linkLabel: "Ver módulo por vertical →",
  },
];

export default function MetodologiaPage() {
  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <CompassIcon className="w-4 h-4" />
            Ferramentas Oficiais Arca BTO
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Metodologia Arca BTO v1.0</h1>
          <p className="text-slate-600">
            O framework proprietário por trás do ArcaOS: 5 princípios que orientam qualquer decisão de
            produto e um ciclo de 5 etapas que se repete a cada novo diagnóstico. Cada bloco abaixo
            linka pra onde já está implementado — nada aqui é só intenção.
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-900 mb-4">5 Princípios Fundamentais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold text-slate-900 mb-1">{p.title}</p>
                <p className="text-sm text-slate-600">{p.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Ciclo Arca BTO — 5 Etapas de Transformação</h2>
          <p className="text-sm text-slate-500 mb-4">
            Não é linear e não termina: a Etapa 5 reabre a Etapa 1 a cada novo ciclo de diagnóstico.
          </p>
          <div className="space-y-3">
            {CYCLE.map((c) => (
              <div key={c.step} className="flex gap-4 rounded-lg border border-slate-200 p-4">
                <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
                  {c.step}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{c.title}</p>
                  <p className="text-xs text-slate-500 mb-1">{c.planDescription}</p>
                  <p className="text-sm text-slate-700">{c.implementation}</p>
                  <Link href={c.href} className="inline-block mt-1 text-xs font-medium text-blue-700 hover:underline">
                    {c.linkLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
            <SparklesIcon className="w-4 h-4" />
            Ferramentas Oficiais Arca BTO
          </p>
          <div className="space-y-3">
            {TOOLS.map((t) => (
              <div key={t.name} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-600">{t.description}</p>
                  <Link href={t.href} className="inline-block mt-1.5 text-xs font-medium text-blue-700 hover:underline">
                    {t.linkLabel}
                  </Link>
                </div>
                <div className="shrink-0">
                  <Badge text={t.status === "ativo" ? "Ativo" : "Vitrine"} tone={t.status === "ativo" ? "good" : "neutral"} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">
            <TrendingUpIcon className="w-4 h-4" />
            9 Verticais Complementares
          </p>
          <p className="text-sm text-slate-600">
            Cada vertical roda essa mesma metodologia de forma isolada quando comercializada
            separadamente (Arca Checkup por vertical) — o ciclo de 5 etapas não muda, só o escopo.
            Veja o{" "}
            <Link href="/empresas" className="text-blue-700 hover:underline">
              módulo de uma vertical
            </Link>{" "}
            numa empresa.
          </p>
        </Card>
      </div>
    </main>
  );
}
