import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";

const STATUS_STYLES: Record<string, string> = {
  "Crítico": "bg-red-100 text-red-700 border-red-200",
  "Frágil": "bg-orange-100 text-orange-700 border-orange-200",
  "Em estruturação": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Gerenciado": "bg-blue-100 text-blue-700 border-blue-200",
  "Otimizado": "bg-green-100 text-green-700 border-green-200",
};

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      diagnostics: {
        orderBy: { createdAt: "asc" },
        include: { answers: true, tasks: true },
      },
      documents: true,
    },
  });
  if (!company) notFound();

  const diagnosticsWithScore = company.diagnostics.map((d) => {
    const report = buildReport(
      d.answers.map((a) => ({ areaKey: a.areaKey, questionId: a.questionId, score: a.score }))
    );
    return { diagnostic: d, report };
  });

  const maxScore = 5;

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/empresas" className="text-sm text-slate-500 hover:text-slate-800">
          ← Todas as empresas
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <p className="text-sm font-semibold text-blue-700 uppercase mb-1">Empresa</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-4">
            {company.segment} · {company.employees || "—"} colaboradores · {company.cities || "—"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/empresas/${id}/documentos`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              📁 Data Room ({company.documents.length})
            </Link>
            <Link
              href="/diagnostico/novo"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              + Novo diagnóstico
            </Link>
          </div>
        </div>

        {diagnosticsWithScore.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Evolução da Maturidade
            </h2>
            <div className="space-y-3">
              {diagnosticsWithScore.map(({ diagnostic, report }) => (
                <div key={diagnostic.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0">
                    {new Date(diagnostic.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <div className="h-3 flex-1 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-700"
                      style={{ width: `${(report.overallAverage / maxScore) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 w-10 text-right">
                    {report.overallAverage.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Diagnósticos</h2>
          {diagnosticsWithScore.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum diagnóstico realizado ainda.</p>
          ) : (
            <div className="space-y-3">
              {[...diagnosticsWithScore].reverse().map(({ diagnostic, report }) => (
                <div
                  key={diagnostic.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {new Date(diagnostic.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                      {diagnostic.status === "concluido"
                        ? "Concluído"
                        : diagnostic.status === "em_execucao"
                          ? "Em execução"
                          : "Em andamento"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Nota geral: {report.overallAverage.toFixed(1)}/5
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_STYLES[report.overallStatus] ?? "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {report.overallStatus}
                    </span>
                    {diagnostic.status === "em_andamento" ? (
                      <Link
                        href={`/diagnostico/${diagnostic.id}/questionario/${diagnostic.answers[0]?.areaKey ?? ""}`}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        Continuar
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`/diagnostico/${diagnostic.id}/relatorio`}
                          className="text-sm font-medium text-blue-700 hover:underline"
                        >
                          Relatório
                        </Link>
                        {diagnostic.tasks.length > 0 && (
                          <Link
                            href={`/diagnostico/${diagnostic.id}/projeto`}
                            className="text-sm font-medium text-blue-700 hover:underline"
                          >
                            Projeto
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
