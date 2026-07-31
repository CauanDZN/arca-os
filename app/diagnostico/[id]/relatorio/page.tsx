import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReport, type AreaScore } from "@/lib/scoring";
import type { AiNarrative, VerticalInsight } from "@/lib/ai";
import { findEvidenceGaps } from "@/lib/audit";
import { statusTone, classificationTone, priorityTone, maturityTone } from "@/lib/badge-tones";
import { getAreaByKey, VERTICAL_AGENT_AREAS } from "@/lib/areas";
import { verticalAverages } from "@/lib/verticals";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { PrintButton } from "./PrintButton";
import { generateNarrativeAction } from "@/app/actions";
import { approveActionPlan } from "@/app/actions-project";
import { generateVerticalInsightAction } from "@/app/actions-vertical";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { ScoreBar } from "@/app/components/ScoreBar";
import { StatTile } from "@/app/components/StatTile";
import { SubmitButton } from "@/app/components/SubmitButton";
import { ReportTabs, type ReportSection } from "@/app/components/ReportTabs";
import { SparklesIcon } from "@/app/components/icons";

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id },
    include: { company: true, answers: true, tasks: true, verticalInsights: true },
  });
  if (!diagnostic) notFound();
  assertCompanyAccess(await getSession(), diagnostic.companyId);

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
  const evidenceGaps = findEvidenceGaps(diagnostic.answers);
  const missingEvidence = new Set(evidenceGaps.map((g) => `${g.areaKey}::${g.questionText}`));
  const areasWithGaps = report.areaScores.filter((a) => a.weakestQuestions.length > 0);

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const verticalInsightByArea = new Map(
    diagnostic.verticalInsights.map((v) => [
      v.areaKey,
      { ...(JSON.parse(v.content) as VerticalInsight), documentsUsed: v.documentsUsed },
    ])
  );
  const verticalAreas = VERTICAL_AGENT_AREAS.map((key) => {
    const area = getAreaByKey(key)!;
    const areaScore = report.areaScores.find((a) => a.area.key === key)!;
    return { area, areaScore, insight: verticalInsightByArea.get(key) ?? null };
  });

  const verticalScores = verticalAverages(
    report.areaScores.map((a) => ({ areaKey: a.area.key, average: a.average }))
  );

  const sections: ReportSection[] = [
    {
      id: "sumario",
      label: "Sumário",
      content: (
        <Card id="sumario">
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            Relatório Executivo · Arca Scan 360
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{diagnostic.company.name}</h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatTile label="Nota geral de maturidade">
              <p className="text-3xl font-bold text-slate-900 mb-1">
                {report.overallAverage.toFixed(1)}
                <span className="text-base text-slate-400">/5</span>
              </p>
              <div className="space-y-1.5">
                <Badge text={report.overallStatus} tone={statusTone(report.overallStatus)} />
                <Badge
                  text={`Nível ${report.maturityLevel} · ${report.maturityLabel}`}
                  tone={maturityTone(report.maturityLevel)}
                />
              </div>
            </StatTile>
            <StatTile label="Segmento">
              <p className="text-slate-900 font-medium">{diagnostic.company.segment || "—"}</p>
              <p className="text-xs text-slate-500 mt-2 mb-1">Objetivo do diagnóstico</p>
              <p className="text-slate-700 text-sm">{objectives.join(", ") || "—"}</p>
            </StatTile>
            <StatTile label="Faturamento médio / margem">
              <p className="text-slate-900 font-medium">
                {diagnostic.company.avgRevenue || "—"} · {diagnostic.company.margin || "—"}
              </p>
            </StatTile>
          </div>

          {aiNarrative ? (
            <div className="mb-6 rounded-xl bg-blue-50/70 border border-blue-100 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                <SparklesIcon className="w-3.5 h-3.5" />
                Análise consultiva · Gerado por IA
              </p>
              <p className="text-sm text-slate-800 leading-relaxed">{aiNarrative.executiveSummary}</p>
            </div>
          ) : hasGeminiKey ? (
            <div className="mb-6 rounded-xl border border-blue-200 bg-white p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                <SparklesIcon className="w-3.5 h-3.5" />
                Análise consultiva
              </p>
              <p className="text-sm text-slate-600 mb-3">
                As respostas já foram salvas. Gere agora a análise consultiva com a IA — leva alguns
                segundos.
              </p>
              <form action={generateNarrativeAction.bind(null, id)}>
                <SubmitButton
                  pendingText="Gerando análise..."
                  className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                >
                  Gerar análise consultiva com IA →
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Análise consultiva indisponível — sem chave de IA configurada.
              </p>
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
        </Card>
      ),
    },
    {
      id: "maturidade",
      label: "Maturidade",
      content: (
        <Card id="maturidade">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Mapa de Maturidade por Área</h2>
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
                  <tr key={a.area.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{a.area.name}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{a.average.toFixed(1)}</td>
                    <td className="py-2.5 pr-4">
                      <ScoreBar score={a.average} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge text={a.status} tone={statusTone(a.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold text-slate-900 mt-8 mb-1">As 8 Verticais da Arca</h3>
          <p className="text-xs text-slate-500 mb-4">
            As 12 áreas do questionário consolidadas nas 8 verticais do pitch da Arca.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {verticalScores.map((v) => (
              <div key={v.key}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-800">{v.name}</span>
                  <span className="text-sm font-semibold text-slate-900">{v.average.toFixed(1)}</span>
                </div>
                <ScoreBar score={v.average} />
              </div>
            ))}
          </div>
        </Card>
      ),
    },
    {
      id: "analitico",
      label: "Diagnóstico",
      content: (
        <Card id="analitico">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Diagnóstico Analítico</h2>
            <span className="text-xs text-slate-400">{areasWithGaps.length} áreas com gaps</span>
          </div>
          <div className="space-y-2">
            {areasWithGaps.map((a: AreaScore) => {
              const insight = aiInsightByArea.get(a.area.key);
              const gapsInArea = a.weakestQuestions.filter((q) =>
                missingEvidence.has(`${a.area.key}::${q.text}`)
              ).length;
              return (
                <details key={a.area.key} className="group rounded-lg border border-slate-200 open:bg-slate-50/60">
                  <summary className="flex items-center gap-3 cursor-pointer select-none px-4 py-3 list-none">
                    <span className="text-slate-400 text-xs transition-transform group-open:rotate-90">▶</span>
                    <span className="font-medium text-slate-900 flex-1">{a.area.name}</span>
                    {gapsInArea > 0 && (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        {gapsInArea} sem evidência
                      </span>
                    )}
                    <Badge text={a.status} tone={statusTone(a.status)} />
                  </summary>
                  <div className="px-4 pb-4 pt-1">
                    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                      {a.weakestQuestions.map((q) => (
                        <li key={q.text}>
                          {q.text} <span className="text-slate-400">(nota {q.score})</span>
                          {missingEvidence.has(`${a.area.key}::${q.text}`) && (
                            <span className="ml-1.5 text-xs font-medium text-amber-700">
                              · sem evidência
                            </span>
                          )}
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
                </details>
              );
            })}
          </div>
        </Card>
      ),
    },
    {
      id: "especialistas",
      label: "Agentes Especialistas",
      content: (
        <Card id="especialistas">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-slate-900">Agentes Especialistas por Área</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Aprofunda a análise em Financeiro, Comercial, Fiscal, Pessoas (RH) e Tecnologia, cruzando
            as respostas do questionário com os documentos do Data Room categorizados em cada área.
          </p>
          <div className="space-y-2">
            {verticalAreas.map(({ area, areaScore, insight }) => (
              <details key={area.key} className="group rounded-lg border border-slate-200 open:bg-slate-50/60">
                <summary className="flex items-center gap-3 cursor-pointer select-none px-4 py-3 list-none">
                  <span className="text-slate-400 text-xs transition-transform group-open:rotate-90">▶</span>
                  <span className="font-medium text-slate-900 flex-1">{area.name}</span>
                  <span className="text-xs text-slate-400">{areaScore.average.toFixed(1)}/5</span>
                  <Badge text={areaScore.status} tone={statusTone(areaScore.status)} />
                </summary>
                <div className="px-4 pb-4 pt-1">
                  {insight ? (
                    <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                        <SparklesIcon className="w-3.5 h-3.5" />
                        Agente de Diagnóstico Vertical · Gerado por IA
                        {insight.documentsUsed > 0 && (
                          <span className="normal-case font-normal text-blue-600">
                            · {insight.documentsUsed} documento(s) do Data Room considerado(s)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-800 leading-relaxed mb-3">{insight.analysis}</p>
                      {insight.recommendations.length > 0 && (
                        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                          {insight.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                      <form action={generateVerticalInsightAction.bind(null, id, area.key)} className="mt-3">
                        <SubmitButton
                          pendingText="Gerando..."
                          className="text-xs font-medium text-blue-700 hover:underline disabled:no-underline"
                        >
                          Gerar novamente
                        </SubmitButton>
                      </form>
                    </div>
                  ) : hasGeminiKey ? (
                    <form action={generateVerticalInsightAction.bind(null, id, area.key)}>
                      <SubmitButton
                        pendingText="Gerando análise..."
                        className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                      >
                        Gerar análise com o Agente Especialista →
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Sem chave de IA configurada — análise especialista indisponível.
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Card>
      ),
    },
    {
      id: "priorizacao",
      label: "Priorização",
      content: (
        <Card id="priorizacao">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Matriz de Priorização</h2>
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
                  <tr key={p.areaKey} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{p.areaName}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{p.average.toFixed(1)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge text={p.classification} tone={classificationTone(p.classification)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ),
    },
    {
      id: "plano",
      label: "Plano de Ação",
      content: (
        <Card id="plano">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-slate-900">Plano de Ação Recomendado</h2>
            {diagnostic.tasks.length > 0 ? (
              <Link
                href={`/diagnostico/${id}/projeto`}
                className="rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-800 transition-colors"
              >
                Ver projeto de execução (Kanban) →
              </Link>
            ) : (
              <form action={approveActionPlan.bind(null, id)}>
                <SubmitButton
                  pendingText="Aprovando..."
                  className="rounded-lg bg-blue-700 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-800 transition-colors"
                >
                  Aprovar plano e criar projeto →
                </SubmitButton>
              </form>
            )}
          </div>
          <div className="space-y-3">
            <ActionBlock title="Primeiros 30 dias" items={report.actionPlan.days30} />
            <ActionBlock title="31 a 90 dias" items={report.actionPlan.days90} />
            <ActionBlock title="3 a 12 meses" items={report.actionPlan.months12} />
          </div>
        </Card>
      ),
    },
  ];

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4 print:bg-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            ← Voltar ao início
          </Link>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <a
              href={`/api/diagnostico/${id}/export`}
              className="flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-center"
            >
              Exportar CSV
            </a>
            <a
              href={`/api/diagnostico/${id}/pdf`}
              className="flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-center"
            >
              Baixar PDF
            </a>
            <PrintButton />
          </div>
        </div>

        {evidenceGaps.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 print:hidden">
            <p className="flex items-center gap-1.5 text-sm text-amber-900">
              <SparklesIcon className="w-4 h-4 shrink-0" />
              <span>
                <span className="font-semibold">Agente de Auditoria de Evidências:</span>{" "}
                {evidenceGaps.length} {evidenceGaps.length === 1 ? "resposta crítica está" : "respostas críticas estão"}{" "}
                sem evidência anexada — veja marcadas em &ldquo;Diagnóstico&rdquo;.
              </span>
            </p>
          </div>
        )}

        <ReportTabs sections={sections} />
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
    <details className="group rounded-lg border border-slate-200 open:bg-slate-50/60" open={items.length <= 5}>
      <summary className="flex items-center gap-3 cursor-pointer select-none px-4 py-3 list-none">
        <span className="text-slate-400 text-xs transition-transform group-open:rotate-90">▶</span>
        <span className="font-semibold text-slate-900 flex-1">{title}</span>
        <span className="text-xs text-slate-400">{items.length} ações</span>
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors"
          >
            <div>
              <p className="text-xs text-slate-500">{item.areaName}</p>
              <p className="text-sm font-medium text-slate-900">{item.action}</p>
            </div>
            <Badge text={item.priority} tone={priorityTone(item.priority)} />
          </div>
        ))}
      </div>
    </details>
  );
}
