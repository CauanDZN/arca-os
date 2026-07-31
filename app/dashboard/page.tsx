import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildDashboardData, buildObservations } from "@/lib/dashboard";
import { statusForScore } from "@/lib/scoring";
import { statusTone, maturityTone } from "@/lib/badge-tones";
import type { BadgeTone } from "@/lib/badge-tones";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { BarChart } from "@/app/components/BarChart";
import { ScoreBar } from "@/app/components/ScoreBar";
import { EmptyBoxIcon, DashboardIcon, BuildingIcon, SparklesIcon, ListChecksIcon } from "@/app/components/icons";

const OBSERVATION_DOT: Record<BadgeTone, string> = {
  critical: "bg-red-500",
  serious: "bg-orange-500",
  warning: "bg-amber-500",
  managed: "bg-blue-500",
  good: "bg-green-500",
  neutral: "bg-slate-400",
};

// Mesma escala de 5 faixas que statusForScore usa (Crítico → Otimizado) — aqui
// mapeada direto pelo nível de maturidade (1–5) em vez da nota, só para
// reaproveitar as cores que o BarChart já reconhece.
const LEVEL_STATUS_LABEL: Record<number, string> = {
  1: "Crítico",
  2: "Frágil",
  3: "Em estruturação",
  4: "Gerenciado",
  5: "Otimizado",
};

function StatCard({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <Card>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </Card>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "sem prazo";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) notFound();

  const data = await buildDashboardData(session);
  const isClient = session.role === "cliente";

  const segmentMax = data.segments.reduce((max, s) => Math.max(max, s.count), 0);
  const levelMax = Math.max(...data.levelDistribution.map((l) => l.count), 1);
  const observations = buildObservations(data);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <DashboardIcon className="w-4 h-4" />
            ArcaOS
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Dashboard de Análise</h1>
          <p className="text-slate-600 text-sm">
            {isClient
              ? "Visão consolidada da sua empresa: maturidade, execução e indicadores."
              : "Visão consolidada da carteira: maturidade média por área e vertical, ranking de empresas e execução do plano de ação."}
          </p>
        </Card>

        {data.companyCount === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhuma empresa cadastrada ainda.</p>
              {!isClient && (
                <Link
                  href="/diagnostico/novo"
                  className="mt-1 text-sm font-medium text-blue-700 hover:underline"
                >
                  Iniciar um diagnóstico →
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                value={String(data.companyCount)}
                label={data.companyCount === 1 ? "Empresa" : "Empresas"}
              />
              <StatCard
                value={String(data.diagnosticCount)}
                label={data.diagnosticCount === 1 ? "Diagnóstico" : "Diagnósticos"}
              />
              <div>
                <Card>
                  <p className="text-2xl font-bold text-slate-900">
                    {data.avgScore === null ? "—" : data.avgScore.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Nota média {data.avgScore === null ? "" : "de 5"}
                  </p>
                  {data.avgScore !== null && (
                    <div className="mt-1.5 space-y-1.5">
                      <Badge text={data.avgStatus} tone={statusTone(data.avgStatus)} />
                      {data.avgLevel !== null && (
                        <Badge
                          text={`Nível ${data.avgLevel} · ${data.avgLevelLabel}`}
                          tone={maturityTone(data.avgLevel)}
                        />
                      )}
                    </div>
                  )}
                </Card>
              </div>
              <div>
                <Card>
                  <p className="text-2xl font-bold text-slate-900">
                    {data.executionPct === null ? "—" : `${data.executionPct}%`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Execução do plano</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {data.doneTasks} de {data.totalTasks} ações concluídas
                  </p>
                </Card>
              </div>
            </div>

            {observations.length > 0 && (
              <Card>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-1">
                  <SparklesIcon className="w-5 h-5 text-blue-700" />
                  Observações
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Leituras automáticas geradas a partir dos dados atuais —{" "}
                  {isClient ? "da sua empresa" : "da carteira"}.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {observations.map((o, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${OBSERVATION_DOT[o.tone]}`} />
                      <p className="text-sm text-slate-700 leading-snug">{o.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-1">
                  <BuildingIcon className="w-5 h-5 text-blue-700" />
                  Maturidade média por área
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Média da nota (0–5) do diagnóstico mais recente de{" "}
                  {isClient ? "sua empresa" : "cada empresa"}.
                </p>
                {data.areaAverages.length > 0 ? (
                  <BarChart
                    items={data.areaAverages.map((a) => ({
                      label: a.areaName,
                      value: a.average,
                      status: a.status,
                      display: `${a.average.toFixed(1)} · ${a.status}`,
                    }))}
                  />
                ) : (
                  <p className="text-sm text-slate-400">
                    Nenhum diagnóstico respondido ainda para calcular as médias.
                  </p>
                )}
              </Card>

              <Card>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Maturidade por vertical</h2>
                <p className="text-xs text-slate-500 mb-4">
                  As 12 áreas do diagnóstico agrupadas nas 8 verticais da Arca.
                </p>
                {data.verticalAverages.some((v) => v.average > 0) ? (
                  <BarChart
                    items={data.verticalAverages.map((v) => ({
                      label: v.name,
                      value: v.average,
                      status: v.average > 0 ? statusForScore(v.average) : undefined,
                      display: v.average > 0 ? `${v.average.toFixed(1)} · ${statusForScore(v.average)}` : "—",
                    }))}
                  />
                ) : (
                  <p className="text-sm text-slate-400">
                    Nenhum diagnóstico respondido ainda para calcular as médias.
                  </p>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Ranking de maturidade</h2>
                <p className="text-xs text-slate-500 mb-4">
                  Empresas ordenadas pela nota geral do diagnóstico mais recente.
                </p>
                {data.ranking.length > 0 ? (
                  <div className="space-y-3">
                    {data.ranking.map((rank, i) => (
                      <div key={rank.id} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400 w-5 shrink-0">
                          {i + 1}º
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <Link
                              href={`/empresas/${rank.id}`}
                              className="text-sm font-medium text-slate-800 hover:text-blue-700 truncate"
                            >
                              {rank.name}
                            </Link>
                            <span className="text-sm font-semibold text-slate-900 shrink-0">
                              {rank.score.toFixed(1)}/5
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ScoreBar score={rank.score} className="h-2 flex-1" />
                            <Badge text={rank.status} tone={statusTone(rank.status)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Nenhum diagnóstico concluído ainda para ranquear.
                  </p>
                )}
              </Card>

              <Card>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Distribuição por nível de maturidade</h2>
                <p className="text-xs text-slate-500 mb-4">
                  Quantas empresas estão em cada nível do motor de maturidade (1–5).
                </p>
                <BarChart
                  items={data.levelDistribution.map((l) => ({
                    label: `Nível ${l.level} · ${l.label}`,
                    value: l.count,
                    max: levelMax,
                    status: LEVEL_STATUS_LABEL[l.level],
                    display: String(l.count),
                  }))}
                  max={levelMax}
                />
              </Card>
            </div>

            {data.atRiskTasks.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <ListChecksIcon className="w-5 h-5 text-blue-700" />
                  <h2 className="text-xl font-bold text-slate-900">Pendências em risco</h2>
                  <Badge text={`${data.atRiskTasks.length}`} tone="warning" />
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Ações do plano de ação atrasadas ou sem responsável definido —{" "}
                  {isClient ? "da sua empresa" : "de toda a carteira"}.
                </p>
                <div className="space-y-2">
                  {data.atRiskTasks.map((task) => (
                    <div
                      key={task.taskId}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{task.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {!isClient && (
                            <>
                              <Link href={`/empresas/${task.companyId}`} className="hover:text-blue-700">
                                {task.companyName}
                              </Link>
                              {" · "}
                            </>
                          )}
                          {task.areaName}
                          {task.reason === "atrasada" && ` · Prazo: ${formatDate(task.dueDate)}`}
                        </p>
                      </div>
                      <Badge
                        text={task.reason === "atrasada" ? "Atrasada" : "Sem responsável"}
                        tone={task.reason === "atrasada" ? "critical" : "warning"}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Empresas por segmento</h2>
                <p className="text-xs text-slate-500 mb-4">
                  Distribuição da carteira por segmento de atuação.
                </p>
                <BarChart
                  items={data.segments.map((s) => ({
                    label: s.segment,
                    value: s.count,
                    max: segmentMax,
                    display: String(s.count),
                  }))}
                  max={Math.max(segmentMax, 1)}
                />
              </Card>

              <Card>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Ciclo Arca em números</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm text-slate-700">Ações concluídas</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {data.doneTasks} de {data.totalTasks}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-status-good transition-all"
                        style={{ width: `${data.executionPct ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Diagnóstico → plano de ação → execução → evolução. Acompanhe a maturidade
                    evoluindo a cada novo diagnóstico e as ações do plano de ação sendo concluídas
                    no Kanban.
                  </p>
                  {!isClient && (
                    <Link
                      href="/relatorios"
                      className="inline-block text-sm font-medium text-blue-700 hover:underline"
                    >
                      Ver todos os relatórios →
                    </Link>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
