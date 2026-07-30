import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/scoring";
import { statusTone } from "@/lib/badge-tones";
import { generateMaturityEvolution } from "@/lib/ai";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ScoreBar } from "@/app/components/ScoreBar";
import { FolderIcon, TrendingUpIcon, EmptyBoxIcon, SparklesIcon } from "@/app/components/icons";

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

  let evolutionNarrative: string | null = null;
  if (diagnosticsWithScore.length > 1) {
    const previous = diagnosticsWithScore[diagnosticsWithScore.length - 2];
    const current = diagnosticsWithScore[diagnosticsWithScore.length - 1];
    evolutionNarrative = await generateMaturityEvolution(
      company.name,
      { date: previous.diagnostic.createdAt, report: previous.report },
      { date: current.diagnostic.createdAt, report: current.report }
    );
  }

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/empresas" className="text-sm text-slate-500 hover:text-slate-800">
          ← Todas as empresas
        </Link>

        <Card>
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">Empresa</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-4">
            {company.segment} · {company.employees || "—"} colaboradores · {company.cities || "—"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/empresas/${id}/documentos`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <FolderIcon />
              Data Room ({company.documents.length})
            </Link>
            <Link
              href="/diagnostico/novo"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              + Novo diagnóstico
            </Link>
          </div>
        </Card>

        {diagnosticsWithScore.length > 1 && (
          <Card>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-4">
              <TrendingUpIcon className="w-5 h-5 text-status-managed" />
              Evolução da Maturidade
            </h2>
            {evolutionNarrative && (
              <div className="mb-4 rounded-xl bg-blue-50/70 border border-blue-100 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Agente de Evolução de Maturidade · Gerado por IA
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">{evolutionNarrative}</p>
              </div>
            )}
            <div className="space-y-3">
              {diagnosticsWithScore.map(({ diagnostic, report }) => (
                <div key={diagnostic.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0">
                    {new Date(diagnostic.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <ScoreBar score={report.overallAverage} className="h-3 flex-1" />
                  <span className="text-sm font-semibold text-slate-800 w-10 text-right">
                    {report.overallAverage.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Diagnósticos</h2>
          {diagnosticsWithScore.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum diagnóstico realizado ainda.</p>
              <Link
                href="/diagnostico/novo"
                className="mt-1 text-sm font-medium text-blue-700 hover:underline"
              >
                Iniciar o primeiro diagnóstico →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {[...diagnosticsWithScore].reverse().map(({ diagnostic, report }) => (
                <div
                  key={diagnostic.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
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
                  <div className="flex items-center gap-2">
                    <Badge text={report.overallStatus} tone={statusTone(report.overallStatus)} />
                    {diagnostic.status === "em_andamento" ? (
                      <Link
                        href={`/diagnostico/${diagnostic.id}/questionario/${diagnostic.answers[0]?.areaKey ?? ""}`}
                        className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 hover:bg-blue-800 transition-colors"
                      >
                        Continuar
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`/diagnostico/${diagnostic.id}/relatorio`}
                          className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 hover:bg-blue-800 transition-colors"
                        >
                          Ver relatório
                        </Link>
                        {diagnostic.tasks.length > 0 && (
                          <Link
                            href={`/diagnostico/${diagnostic.id}/projeto`}
                            className="rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-3 py-1.5 hover:bg-slate-100 transition-colors"
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
        </Card>
      </div>
    </main>
  );
}
