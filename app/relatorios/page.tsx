import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";
import { statusTone } from "@/lib/badge-tones";
import { Badge } from "@/app/components/Badge";
import { EmptyBoxIcon, DocumentIcon } from "@/app/components/icons";

export default async function RelatoriosPage() {
  const diagnostics = await prisma.diagnostic.findMany({
    where: { status: { in: ["concluido", "em_execucao"] } },
    orderBy: { createdAt: "desc" },
    include: { company: true, answers: true, tasks: true },
  });

  const rows = diagnostics.map((d) => {
    const report = buildReport(
      d.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
    );
    return { diagnostic: d, report };
  });

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <DocumentIcon className="w-4 h-4" />
            ArcaOS
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-slate-600 mt-1">
            Todos os diagnósticos concluídos, com acesso direto ao relatório executivo e ao
            projeto de execução.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center py-14">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum relatório gerado ainda.</p>
              <Link
                href="/diagnostico/novo"
                className="mt-1 text-sm font-medium text-blue-700 hover:underline"
              >
                Iniciar um diagnóstico →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Nota</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ diagnostic, report }) => (
                  <tr
                    key={diagnostic.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {diagnostic.company.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(diagnostic.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {report.overallAverage.toFixed(1)}/5
                    </td>
                    <td className="py-3 px-4">
                      <Badge text={report.overallStatus} tone={statusTone(report.overallStatus)} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/diagnostico/${diagnostic.id}/relatorio`}
                        className="text-blue-700 font-medium hover:underline"
                      >
                        Relatório
                      </Link>
                      {diagnostic.tasks.length > 0 && (
                        <Link
                          href={`/diagnostico/${diagnostic.id}/projeto`}
                          className="text-blue-700 font-medium hover:underline ml-4"
                        >
                          Projeto
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
