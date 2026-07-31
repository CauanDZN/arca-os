import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { moveTask, updateTaskDetails, createSprint, deleteSprint, createEpic, deleteEpic } from "@/app/actions-project";
import { priorityTone } from "@/lib/badge-tones";
import { findAtRiskTasks } from "@/lib/pmo";
import { findScrumIssues } from "@/lib/scrum-master";
import { generateSprintReport } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
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
  const events =
    totalTasks > 0
      ? await prisma.taskEvent.findMany({
          where: { task: { diagnosticId: id }, createdAt: { gte: since } },
          include: { task: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const sprintReport =
    events.length > 0
      ? await generateSprintReport(
          diagnostic.company.name,
          events.map((e) => ({
            taskTitle: e.task.title,
            areaName: e.task.areaName,
            fromStatus: e.fromStatus,
            toStatus: e.toStatus,
            createdAt: e.createdAt,
          })),
          SPRINT_PERIOD_DAYS
        )
      : null;

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Link href={`/diagnostico/${id}/relatorio`} className="text-sm text-slate-500 hover:text-slate-800">
              ← Voltar ao relatório
            </Link>
            <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mt-2">
              Projeto de Execução Arca
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
                          <button type="submit" className="text-xs text-red-600 hover:underline whitespace-nowrap">
                            Remover
                          </button>
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
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-blue-700 select-none">
                  + Novo épico
                </summary>
                <form
                  action={createEpic.bind(null, id)}
                  className="mt-3 grid grid-cols-1 gap-3"
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
                  <button
                    type="submit"
                    className="self-start rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                  >
                    Criar épico
                  </button>
                </form>
              </details>
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
                          <button type="submit" className="text-xs text-red-600 hover:underline whitespace-nowrap">
                            Remover
                          </button>
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
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-blue-700 select-none">
                  + Novo sprint
                </summary>
                <form
                  action={createSprint.bind(null, id)}
                  className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
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
                  <button
                    type="submit"
                    className="self-start rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors sm:col-span-2"
                  >
                    Criar sprint
                  </button>
                </form>
              </details>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {COLUMNS.map((col) => {
                const columnTasks = diagnostic.tasks.filter((t) => t.status === col.status);
                return (
                  <div
                    key={col.status}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4"
                  >
                    <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                      {col.title}
                      <span className="ml-auto text-xs font-normal text-slate-400">
                        {columnTasks.length}
                      </span>
                    </h2>
                    <div className="space-y-3">
                      {columnTasks.map((task) => {
                        const isOverdue = overdueTaskIds.has(task.id);
                        const sprintName = diagnostic.sprints.find((s) => s.id === task.sprintId)?.name;
                        const epicName = diagnostic.epics.find((e) => e.id === task.epicId)?.name;
                        return (
                          <div
                            key={task.id}
                            className="rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors"
                          >
                            <p className="text-xs text-slate-500 mb-1">{task.areaName}</p>
                            <p className="text-sm font-medium text-slate-900 mb-1">{task.title}</p>
                            {task.rootCause && (
                              <p className="text-xs text-slate-500 italic mb-2">Causa: {task.rootCause}</p>
                            )}
                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                              <Badge text={task.priority} tone={priorityTone(task.priority)} />
                              <span className="text-xs text-slate-400">{task.timeframe}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                              {task.responsible && (
                                <span className="text-slate-600">{task.responsible}</span>
                              )}
                              {task.dueDate && (
                                <span className={isOverdue ? "font-semibold text-red-600" : "text-slate-500"}>
                                  {isOverdue ? "Atrasada · " : "Prazo: "}
                                  {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              {epicName && (
                                <span className="text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                                  {epicName}
                                </span>
                              )}
                              {sprintName && (
                                <span className="text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                                  {sprintName}
                                </span>
                              )}
                            </div>

                            <details className="mt-2 group">
                              <summary className="cursor-pointer text-xs font-medium text-blue-700 select-none">
                                + Detalhes
                              </summary>
                              <form
                                action={updateTaskDetails.bind(null, id, task.id)}
                                className="mt-2 flex flex-col gap-1.5"
                              >
                                <input
                                  type="text"
                                  name="responsible"
                                  defaultValue={task.responsible}
                                  placeholder="Responsável"
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                                />
                                <input
                                  type="date"
                                  name="dueDate"
                                  defaultValue={
                                    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
                                  }
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                                />
                                {diagnostic.epics.length > 0 && (
                                  <select
                                    name="epicId"
                                    defaultValue={task.epicId ?? ""}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
                                  >
                                    <option value="">Sem épico</option>
                                    {diagnostic.epics.map((e) => (
                                      <option key={e.id} value={e.id}>
                                        {e.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {diagnostic.sprints.length > 0 && (
                                  <select
                                    name="sprintId"
                                    defaultValue={task.sprintId ?? ""}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
                                  >
                                    <option value="">Sem sprint</option>
                                    {diagnostic.sprints.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <input
                                  type="text"
                                  name="successIndicator"
                                  defaultValue={task.successIndicator}
                                  placeholder="Indicador de sucesso"
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                                />
                                <input
                                  type="text"
                                  name="dependencies"
                                  defaultValue={task.dependencies}
                                  placeholder="Dependências"
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                                />
                                <input
                                  type="text"
                                  name="completionEvidence"
                                  defaultValue={task.completionEvidence}
                                  placeholder="Evidência de conclusão"
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                                />
                                <button
                                  type="submit"
                                  className="self-start rounded-md bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 hover:bg-slate-900 transition-colors"
                                >
                                  Salvar
                                </button>
                              </form>
                            </details>

                            <div className="mt-2 flex gap-2">
                              {col.status !== "todo" && (
                                <form action={moveTask.bind(null, id, task.id, "backward")}>
                                  <button
                                    type="submit"
                                    className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                                  >
                                    ← Voltar
                                  </button>
                                </form>
                              )}
                              {col.status !== "done" && (
                                <form action={moveTask.bind(null, id, task.id, "forward")} className="ml-auto">
                                  <button
                                    type="submit"
                                    className="text-xs text-blue-700 hover:underline"
                                  >
                                    Avançar →
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {columnTasks.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Card>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-3">
                <SparklesIcon className="w-4 h-4 text-blue-700" />
                Agente de Relatório de Sprint
              </h2>
              {sprintReport ? (
                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                    Últimos {SPRINT_PERIOD_DAYS} dias · Gerado por IA
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">{sprintReport}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {events.length === 0
                    ? `Nenhuma movimentação no quadro nos últimos ${SPRINT_PERIOD_DAYS} dias.`
                    : "Sem chave de IA configurada — resumo automático indisponível."}
                </p>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
