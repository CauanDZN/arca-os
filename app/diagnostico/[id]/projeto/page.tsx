import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { moveTask } from "@/app/actions-project";
import { priorityTone } from "@/lib/badge-tones";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { EmptyBoxIcon } from "@/app/components/icons";

const COLUMNS: { status: string; title: string; accent: string }[] = [
  { status: "todo", title: "A Fazer", accent: "bg-slate-300" },
  { status: "doing", title: "Em Andamento", accent: "bg-status-managed" },
  { status: "done", title: "Concluído", accent: "bg-status-good" },
];

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
    },
  });
  if (!diagnostic) notFound();

  const totalTasks = diagnostic.tasks.length;
  const doneTasks = diagnostic.tasks.filter((t) => t.status === "done").length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

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
                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors"
                      >
                        <p className="text-xs text-slate-500 mb-1">{task.areaName}</p>
                        <p className="text-sm font-medium text-slate-900 mb-2">{task.title}</p>
                        <div className="flex items-center justify-between">
                          <Badge text={task.priority} tone={priorityTone(task.priority)} />
                          <span className="text-xs text-slate-400">{task.timeframe}</span>
                        </div>
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
                    ))}
                    {columnTasks.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
