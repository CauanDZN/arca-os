import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReport, type AreaScore } from "@/lib/scoring";
import type { AiNarrative } from "@/lib/ai";
import { PrintButton } from "./PrintButton";
import { approveActionPlan } from "@/app/actions-project";

const STATUS_STYLES: Record<string, string> = {
  "Crítico": "bg-red-100 text-red-700 border-red-200",
  "Frágil": "bg-orange-100 text-orange-700 border-orange-200",
  "Em estruturação": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Gerenciado": "bg-blue-100 text-blue-700 border-blue-200",
  "Otimizado": "bg-green-100 text-green-700 border-green-200",
};

const CLASS_STYLES: Record<string, string> = {
  "Estrutural": "bg-red-100 text-red-700 border-red-200",
  "Quick Win": "bg-green-100 text-green-700 border-green-200",
  "Corretiva": "bg-orange-100 text-orange-700 border-orange-200",
  "Estratégica": "bg-blue-100 text-blue-700 border-blue-200",
  "Não prioritária": "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_STYLES: Record<string, string> = {
  Alta: "bg-red-100 text-red-700",
  Média: "bg-yellow-100 text-yellow-700",
  Baixa: "bg-slate-100 text-slate-600",
};

function Badge({ text, styles }: { text: string; styles: Record<string, string> }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        styles[text] ?? "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {text}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  return (
    <div className="h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full bg-blue-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id },
    include: { company: true, answers: true, tasks: true },
  });
  if (!diagnostic) notFound();

  const report = buildReport(
    diagnostic.answers.map((a) => ({
      areaKey: a.areaKey,
      questionId: a.questionId,
      score: a.score,
    }))
  );
  const objectives: string[] = JSON.parse(diagnostic.company.objectives || "[]");
  const aiNarrative: AiNarrative | null = diagnostic.aiNarrative
    ? JSON.parse(diagnostic.aiNarrative)
    : null;
  const aiInsightByArea = new Map(
    (aiNarrative?.areaInsights ?? []).map((i) => [i.areaKey, i])
  );

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4 print:bg-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            ← Voltar ao início
          </Link>
          <div className="flex gap-2">
            <a
              href={`/api/diagnostico/${id}/pdf`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Baixar PDF
            </a>
            <PrintButton />
          </div>
        </div>

        {/* 1. Sumário Executivo */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <p className="text-sm font-semibold text-blue-700 uppercase mb-1">
            Relatório Executivo · Arca Scan 360
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            {diagnostic.company.name}
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Nota geral de maturidade</p>
              <p className="text-3xl font-bold text-slate-900">
                {report.overallAverage.toFixed(1)}
                <span className="text-base text-slate-400">/5</span>
              </p>
              <Badge text={report.overallStatus} styles={STATUS_STYLES} />
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Segmento</p>
              <p className="text-slate-900 font-medium">{diagnostic.company.segment || "—"}</p>
              <p className="text-xs text-slate-500 mt-2 mb-1">Objetivo do diagnóstico</p>
              <p className="text-slate-700 text-sm">{objectives.join(", ") || "—"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Faturamento médio / margem</p>
              <p className="text-slate-900 font-medium">
                {diagnostic.company.avgRevenue || "—"} · {diagnostic.company.margin || "—"}
              </p>
            </div>
          </div>

          {aiNarrative && (
            <div className="mb-6 rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                Análise consultiva · Gerado por IA
              </p>
              <p className="text-sm text-slate-800">{aiNarrative.executiveSummary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Principais forças</h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {report.strengths.map((s) => (
                  <li key={s.area.key}>
                    <span className="font-medium">{s.area.name}</span> — {s.average.toFixed(1)}/5
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Principais riscos</h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {report.risks.map((r) => (
                  <li key={r.area.key}>
                    <span className="font-medium">{r.area.name}</span> — {r.average.toFixed(1)}/5
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 2. Mapa de Maturidade por Área */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Mapa de Maturidade por Área
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Área</th>
                  <th className="py-2 pr-4">Nota</th>
                  <th className="py-2 pr-4">Evolução</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.areaScores.map((a) => (
                  <tr key={a.area.key} className="border-b border-slate-100">
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{a.area.name}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{a.average.toFixed(1)}</td>
                    <td className="py-2.5 pr-4">
                      <ScoreBar score={a.average} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge text={a.status} styles={STATUS_STYLES} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Diagnóstico Analítico */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Diagnóstico Analítico
          </h2>
          <div className="space-y-5">
            {report.areaScores
              .filter((a) => a.weakestQuestions.length > 0)
              .map((a: AreaScore) => {
                const insight = aiInsightByArea.get(a.area.key);
                return (
                  <div key={a.area.key} className="border-b border-slate-100 pb-4 last:border-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{a.area.name}</h3>
                      <Badge text={a.status} styles={STATUS_STYLES} />
                    </div>
                    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                      {a.weakestQuestions.map((q) => (
                        <li key={q.text}>
                          {q.text}{" "}
                          <span className="text-slate-400">(nota {q.score})</span>
                        </li>
                      ))}
                    </ul>
                    {insight && (
                      <div className="mt-3 text-sm space-y-1">
                        <p>
                          <span className="font-semibold text-slate-700">Causa raiz: </span>
                          <span className="text-slate-700">{insight.causaRaiz}</span>
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700">Recomendação da Arca: </span>
                          <span className="text-slate-700">{insight.recomendacao}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        {/* 4. Matriz de Priorização */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Matriz de Priorização
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Área</th>
                  <th className="py-2 pr-4">Nota</th>
                  <th className="py-2 pr-4">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {report.priorityMatrix.map((p) => (
                  <tr key={p.areaKey} className="border-b border-slate-100">
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{p.areaName}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{p.average.toFixed(1)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge text={p.classification} styles={CLASS_STYLES} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Plano de Ação Recomendado */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-slate-900">
              Plano de Ação Recomendado
            </h2>
            {diagnostic.tasks.length > 0 ? (
              <Link
                href={`/diagnostico/${id}/projeto`}
                className="rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-800 transition-colors"
              >
                Ver projeto de execução (Kanban) →
              </Link>
            ) : (
              <form action={approveActionPlan.bind(null, id)}>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-800 transition-colors"
                >
                  Aprovar plano e criar projeto →
                </button>
              </form>
            )}
          </div>
          <div className="space-y-8">
            <ActionBlock title="Primeiros 30 dias" items={report.actionPlan.days30} />
            <ActionBlock title="31 a 90 dias" items={report.actionPlan.days90} />
            <ActionBlock title="3 a 12 meses" items={report.actionPlan.months12} />
          </div>
        </section>
      </div>
    </main>
  );
}

function ActionBlock({
  title,
  items,
}: {
  title: string;
  items: {
    areaName: string;
    problem: string;
    action: string;
    priority: string;
  }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3"
          >
            <div>
              <p className="text-xs text-slate-500">{item.areaName}</p>
              <p className="text-sm font-medium text-slate-900">{item.action}</p>
            </div>
            <Badge text={item.priority} styles={PRIORITY_STYLES} />
          </div>
        ))}
      </div>
    </div>
  );
}
