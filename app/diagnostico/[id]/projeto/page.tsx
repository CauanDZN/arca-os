import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  createSprint,
  deleteSprint,
  createEpic,
  deleteEpic,
  generateSprintReportAction,
} from "@/app/actions-project";
import { findAtRiskTasks } from "@/lib/pmo";
import { findScrumIssues } from "@/lib/scrum-master";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { Card } from "@/app/components/Card";
import { SubmitButton } from "@/app/components/SubmitButton";
import { ExpandableTrigger } from "@/app/components/ExpandableTrigger";
import { KanbanBoardClient } from "@/app/components/KanbanBoardClient";
import { EmptyBoxIcon, SparklesIcon } from "@/app/components/icons";

const COLUMNS: { status: string; title: string; accent: string }[] = [
  { status: "todo", title: "A Fazer", accent: "bg-slate-300" },
  { status: "doing", title: "Em Andamento", accent: "bg-status-managed" },
  { status: "done", title: "Concluído", accent: "bg-status-good" },
];

const SPRINT_PERIOD_DAYS = 30;

export default async function ProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id },
    include: {
      company: true,
      tasks: { orderBy: [{ status: "asc" }, { position: "asc" }] },
      sprints: { orderBy: { startDate: "asc" } },
      epics: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!diagnostic) notFound();
  assertCompanyAccess(await getSession(), diagnostic.companyId);

  const totalTasks = diagnostic.tasks.length;
  const doneTasks = diagnostic.tasks.filter((t) => t.status === "done").length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const now = new Date();
  const atRiskTasks = findAtRiskTasks(
    diagnostic.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      areaName: t.areaName,
      status: t.status,
      dueDate: t.dueDate,
      responsible: t.responsible,
    })),
    now
  );
  const overdueTaskIds = new Set(
    atRiskTasks.filter((a) => a.reason === "atrasada").map((a) => a.taskId)
  );
  const overdueCount = overdueTaskIds.size;
  const noOwnerCount = atRiskTasks.filter((a) => a.reason === "sem_responsavel").length;

  const scrumIssues = findScrumIssues(
    diagnostic.sprints.map((s) => ({ id: s.id, name: s.name, endDate: s.endDate })),
    diagnostic.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      areaName: t.areaName,
      status: t.status,
      sprintId: t.sprintId,
      updatedAt: t.updatedAt,
    })),
    now
  );

  const sprintsWithProgress = diagnostic.sprints.map((sprint) => {
    const sprintTasks = diagnostic.tasks.filter((t) => t.sprintId === sprint.id);
    const done = sprintTasks.filter((t) => t.status === "done").length;
    return {
      sprint,
      total: sprintTasks.length,
      done,
      pct: sprintTasks.length > 0 ? Math.round((done / sprintTasks.length) * 100) : 0,
    };
  });

  const epicsWithProgress = diagnostic.epics.map((epic) => {
    const epicTasks = diagnostic.tasks.filter((t) => t.epicId === epic.id);
    const done = epicTasks.filter((t) => t.status === "done").length;
    return {
      epic,
      total: epicTasks.length,
      done,
      pct: epicTasks.length > 0 ? Math.round((done / epicTasks.length) * 100) : 0,
    };
  });

  const since = new Date(now.getTime() - SPRINT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const recentEventCount =
    totalTasks > 0
      ? await prisma.taskEvent.count({
          where: { task: { diagnosticId: id }, createdAt: { gte: since } },
        })
      : 0;
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Link href={`/diagnostico/${id}/relatorio`} className="text-sm text-slate-500 hover:text-slate-800">
              ← Voltar ao relatório
            </Link>
            <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mt-2">
              Arca Planner · Projeto de Execução
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{diagnostic.company.name}</h1>
          </div>
          {totalTasks > 0 && (
            <div className="w-full sm:w-56">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-slate-500">Progresso</span>
                <span className="text-lg font-bold text-slate-900">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-status-good transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {doneTasks} de {totalTasks} ações concluídas
              </p>
            </div>
          )}
        </div>

        {(overdueCount > 0 || noOwnerCount > 0) && (
          <Card className="border-amber-200 bg-amber-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              <SparklesIcon className="w-3.5 h-3.5" />
              Agente PMO
            </p>
            <p className="text-sm text-slate-800">
              {overdueCount > 0 && (
                <>
                  {overdueCount} {overdueCount === 1 ? "ação atrasada" : "ações atrasadas"}
                </>
              )}
              {overdueCount > 0 && noOwnerCount > 0 && " · "}
              {noOwnerCount > 0 && (
                <>
                  {noOwnerCount} {noOwnerCount === 1 ? "ação sem" : "ações sem"} responsável definido
                </>
              )}
            </p>
          </Card>
        )}

        {(scrumIssues.overdueSprints.length > 0 ||
          scrumIssues.emptySprints.length > 0 ||
          scrumIssues.stuckTasks.length > 0) && (
          <Card className="border-purple-200 bg-purple-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">
              <SparklesIcon className="w-3.5 h-3.5" />
              Agente Scrum Master
            </p>
            <div className="space-y-1 text-sm text-slate-800">
              {scrumIssues.overdueSprints.map((s) => (
                <p key={s.sprintId}>
                  Sprint <span className="font-medium">{s.sprintName}</span> está atrasado — {s.pct}%
                  concluído, prazo era {s.endDate.toLocaleDateString("pt-BR")}.
                </p>
              ))}
              {scrumIssues.emptySprints.map((s) => (
                <p key={s.sprintId}>
                  Sprint <span className="font-medium">{s.sprintName}</span> não tem nenhuma ação
                  atribuída.
                </p>
              ))}
              {scrumIssues.stuckTasks.length > 0 && (
                <p>
                  {scrumIssues.stuckTasks.length}{" "}
                  {scrumIssues.stuckTasks.length === 1 ? "ação" : "ações"} sem movimentação há mais de
                  14 dias.
                </p>
              )}
            </div>
          </Card>
        )}

        {totalTasks === 0 ? (
          <Card className="text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-slate-600">
                Nenhuma ação criada ainda. Volte ao relatório e aprove o plano de ação.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <h2 className="text-lg font-bold text-slate-900 mb-3">Épicos</h2>
              {epicsWithProgress.length > 0 && (
                <div className="space-y-3 mb-4">
                  {epicsWithProgress.map(({ epic, total, done, pct: epicPct }) => (
                    <div key={epic.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{epic.name}</p>
                          {epic.description && <p className="text-xs text-slate-500">{epic.description}</p>}
                        </div>
                        <form action={deleteEpic.bind(null, id, epic.id)}>
                          <SubmitButton
                            pendingText="Removendo..."
                            className="text-xs text-red-600 hover:underline whitespace-nowrap disabled:no-underline"
                          >
                            Remover
                          </SubmitButton>
                        </form>
                      </div>
                      <p className="text-xs text-slate-400 mb-1.5">{done} de {total} ações</p>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-status-managed transition-all"
                          style={{ width: `${epicPct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <ExpandableTrigger label="Novo épico">
                <form
                  action={createEpic.bind(null, id)}
                  className="grid grid-cols-1 gap-3"
                >
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Nome</span>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Ex.: Governança e Compliance"
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Descrição (opcional)</span>
                    <input
                      type="text"
                      name="description"
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <SubmitButton
                    pendingText="Criando..."
                    className="self-start rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                  >
                    Criar épico
                  </SubmitButton>
                </form>
              </ExpandableTrigger>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-slate-900 mb-3">Sprints</h2>
              {sprintsWithProgress.length > 0 && (
                <div className="space-y-3 mb-4">
                  {sprintsWithProgress.map(({ sprint, total, done, pct: sprintPct }) => (
                    <div key={sprint.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{sprint.name}</p>
                          {sprint.goal && <p className="text-xs text-slate-500">{sprint.goal}</p>}
                        </div>
                        <form action={deleteSprint.bind(null, id, sprint.id)}>
                          <SubmitButton
                            pendingText="Removendo..."
                            className="text-xs text-red-600 hover:underline whitespace-nowrap disabled:no-underline"
                          >
                            Remover
                          </SubmitButton>
                        </form>
                      </div>
                      <p className="text-xs text-slate-400 mb-1.5">
                        {new Date(sprint.startDate).toLocaleDateString("pt-BR")} a{" "}
                        {new Date(sprint.endDate).toLocaleDateString("pt-BR")} · {done} de {total} ações
                      </p>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-status-good transition-all"
                          style={{ width: `${sprintPct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <ExpandableTrigger label="Novo sprint">
                <form
                  action={createSprint.bind(null, id)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Nome</span>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Sprint 1 — Organização Financeira"
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Meta (opcional)</span>
                    <input
                      type="text"
                      name="goal"
                      placeholder="Ex.: implantar DRE gerencial e fluxo de caixa"
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Início</span>
                    <input
                      type="date"
                      name="startDate"
                      required
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Fim</span>
                    <input
                      type="date"
                      name="endDate"
                      required
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <SubmitButton
                    pendingText="Criando..."
                    className="self-start rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors sm:col-span-2"
                  >
                    Criar sprint
                  </SubmitButton>
                </form>
              </ExpandableTrigger>
            </Card>

            <KanbanBoardClient
              diagnosticId={id}
              columns={COLUMNS}
              epics={diagnostic.epics.map((e) => ({ id: e.id, name: e.name }))}
              sprints={diagnostic.sprints.map((s) => ({ id: s.id, name: s.name }))}
              initialTasks={diagnostic.tasks.map((task) => ({
                id: task.id,
                title: task.title,
                areaName: task.areaName,
                priority: task.priority,
                timeframe: task.timeframe,
                status: task.status,
                position: task.position,
                responsible: task.responsible,
                dueDate: task.dueDate,
                rootCause: task.rootCause,
                successIndicator: task.successIndicator,
                dependencies: task.dependencies,
                completionEvidence: task.completionEvidence,
                epicId: task.epicId,
                sprintId: task.sprintId,
                isOverdue: overdueTaskIds.has(task.id),
                sprintName: diagnostic.sprints.find((s) => s.id === task.sprintId)?.name,
                epicName: diagnostic.epics.find((e) => e.id === task.epicId)?.name,
              }))}
            />

            <Card id="relatorio-sprint">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-3">
                <SparklesIcon className="w-4 h-4 text-blue-700" />
                Agente de Relatório de Sprint
              </h2>
              {diagnostic.sprintReportContent ? (
                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                    Últimos {SPRINT_PERIOD_DAYS} dias · Gerado por IA
                    {diagnostic.sprintReportUpdatedAt && (
                      <span className="normal-case font-normal text-blue-600">
                        {" "}
                        · atualizado em{" "}
                        {new Date(diagnostic.sprintReportUpdatedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed mb-3">
                    {diagnostic.sprintReportContent}
                  </p>
                  <form action={generateSprintReportAction.bind(null, id)}>
                    <SubmitButton
                      pendingText="Gerando..."
                      className="text-xs font-medium text-blue-700 hover:underline disabled:no-underline"
                    >
                      Atualizar resumo
                    </SubmitButton>
                  </form>
                </div>
              ) : recentEventCount === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma movimentação no quadro nos últimos {SPRINT_PERIOD_DAYS} dias.
                </p>
              ) : hasGeminiKey ? (
                <form action={generateSprintReportAction.bind(null, id)}>
                  <SubmitButton
                    pendingText="Gerando resumo..."
                    className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                  >
                    Gerar resumo com o Agente de Sprint →
                  </SubmitButton>
                </form>
              ) : (
                <p className="text-sm text-slate-500">
                  Sem chave de IA configurada — resumo automático indisponível.
                </p>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
