import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { moveTask } from "@/app/actions-project";

const PRIORITY_STYLES: Record<string, string> = {
  Alta: "bg-red-100 text-red-700",
  Média: "bg-yellow-100 text-yellow-700",
  Baixa: "bg-slate-100 text-slate-600",
};

const COLUMNS: { status: string; title: string }[] = [
  { status: "todo", title: "A Fazer" },
  { status: "doing", title: "Em Andamento" },
  { status: "done", title: "Concluído" },
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href={`/diagnostico/${id}/relatorio`} className="text-sm text-slate-500 hover:text-slate-800">
              ← Voltar ao relatório
            </Link>
            <p className="text-sm font-semibold text-blue-700 uppercase mt-2">
              Projeto de Execução Arca
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{diagnostic.company.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Progresso</p>
            <p className="text-2xl font-bold text-slate-900">{pct}%</p>
            <p className="text-xs text-slate-500">
              {doneTasks} de {totalTasks} ações concluídas
            </p>
          </div>
        </div>

        {totalTasks === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-600">
              Nenhuma ação criada ainda. Volte ao relatório e aprove o plano de ação.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COLUMNS.map((col) => {
              const columnTasks = diagnostic.tasks.filter((t) => t.status === col.status);
              return (
                <div key={col.status} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                  <h2 className="font-semibold text-slate-900 mb-3 flex items-center justify-between">
                    {col.title}
                    <span className="text-xs font-normal text-slate-400">{columnTasks.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {columnTasks.map((task) => (
                      <div key={task.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs text-slate-500 mb-1">{task.areaName}</p>
                        <p className="text-sm font-medium text-slate-900 mb-2">{task.title}</p>
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                              PRIORITY_STYLES[task.priority] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {task.priority}
                          </span>
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
                      <p className="text-xs text-slate-400 text-center py-4">Vazio</p>
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
