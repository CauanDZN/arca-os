import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AREAS, getAreaByKey } from "@/lib/areas";
import {
  upsertKpiEntry,
  deleteKpiEntry,
  applyKpiSuggestion,
  rejectKpiSuggestion,
  generatePerformanceInsightAction,
} from "@/app/actions-kpis";
import { findKpiAlerts } from "@/lib/strategic-alerts";
import { Card } from "@/app/components/Card";
import { SubmitButton } from "@/app/components/SubmitButton";
import { EmptyBoxIcon, TrendingUpIcon, SparklesIcon } from "@/app/components/icons";

export default async function IndicadoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      kpiEntries: { orderBy: { month: "asc" } },
      kpiSuggestions: { where: { status: "pendente" }, include: { document: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!company) notFound();

  const createAction = upsertKpiEntry.bind(null, id);

  const grouped = new Map<string, typeof company.kpiEntries>();
  for (const entry of company.kpiEntries) {
    const key = `${entry.areaKey}::${entry.indicatorName}`;
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }

  const entriesForAgents = company.kpiEntries.map((e) => ({
    areaName: getAreaByKey(e.areaKey)?.name ?? e.areaKey,
    indicatorName: e.indicatorName,
    month: e.month,
    value: e.value,
  }));
  const kpiAlerts = findKpiAlerts(entriesForAgents);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={`/empresas/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar para {company.name}
        </Link>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <TrendingUpIcon className="w-4 h-4" />
            Cockpit de Performance
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-6">
            Registre manualmente os indicadores do mês por área — sem integração bancária ou de ERP, é
            entrada direta, igual ao diagnóstico. A exportação em CSV alimenta um BI externo se preciso.
          </p>

          <form action={createAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">Indicador</span>
              <select
                name="indicator"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm bg-white"
              >
                <option value="" disabled>
                  Selecione um indicador
                </option>
                {AREAS.map((area) => (
                  <optgroup key={area.key} label={area.name}>
                    {area.indicators.map((indicator) => (
                      <option key={indicator} value={`${area.key}::${indicator}`}>
                        {indicator}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Mês</span>
              <input
                type="month"
                name="month"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Valor</span>
              <input
                type="number"
                name="value"
                step="any"
                required
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">Meta (opcional)</span>
              <input
                type="number"
                name="target"
                step="any"
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
            <SubmitButton
              pendingText="Salvando..."
              className="rounded-lg bg-blue-700 text-white font-semibold px-5 py-2 text-sm hover:bg-blue-800 transition-colors sm:col-span-2 self-start"
            >
              Salvar indicador
            </SubmitButton>
          </form>

          {company.kpiEntries.length > 0 && (
            <a
              href={`/api/empresas/${id}/kpis/export`}
              className="inline-block mt-4 text-sm font-medium text-blue-700 hover:underline"
            >
              Exportar histórico em CSV →
            </a>
          )}
        </Card>

        {company.kpiSuggestions.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
              <SparklesIcon className="w-3.5 h-3.5" />
              Agente de Extração de Indicadores · Sugestões pendentes
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Lidas automaticamente de documentos enviados ao Data Room — confirme antes de virar
              indicador oficial.
            </p>
            <div className="space-y-2">
              {company.kpiSuggestions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium text-slate-900">{s.indicatorName}</span>
                    <span className="text-slate-500"> ({getAreaByKey(s.areaKey)?.name ?? s.areaKey})</span>
                    <span className="text-slate-700"> — {s.month}: {s.value}</span>
                    <p className="text-xs text-slate-400 truncate">de {s.document.originalName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={applyKpiSuggestion.bind(null, id, s.id)}>
                      <SubmitButton
                        pendingText="Aplicando..."
                        className="text-xs font-semibold text-green-700 hover:underline disabled:no-underline"
                      >
                        Aplicar
                      </SubmitButton>
                    </form>
                    <form action={rejectKpiSuggestion.bind(null, id, s.id)}>
                      <SubmitButton
                        pendingText="Rejeitando..."
                        className="text-xs text-red-600 hover:underline disabled:no-underline"
                      >
                        Rejeitar
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {kpiAlerts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
              <SparklesIcon className="w-3.5 h-3.5" />
              Agente de Alertas Estratégicos
            </p>
            <div className="space-y-1.5">
              {kpiAlerts.map((alert) => (
                <p key={`${alert.areaName}::${alert.indicatorName}`} className="text-sm text-slate-800">
                  <span className="font-medium">{alert.indicatorName}</span> ({alert.areaName}):{" "}
                  {alert.direction === "queda" ? "caiu" : "subiu"}{" "}
                  <span className={alert.direction === "queda" ? "font-semibold text-red-600" : "font-semibold text-green-700"}>
                    {Math.abs(alert.changePct)}%
                  </span>{" "}
                  de {alert.fromMonth} ({alert.fromValue}) para {alert.toMonth} ({alert.toValue}).
                </p>
              ))}
            </div>
          </Card>
        )}

        {company.kpiEntries.length > 0 && (
          <Card id="performance">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
              <SparklesIcon className="w-3.5 h-3.5" />
              Agente de Performance por Área
              {company.performanceInsight && company.performanceInsightUpdatedAt && (
                <span className="normal-case font-normal text-blue-600">
                  · atualizado em{" "}
                  {new Date(company.performanceInsightUpdatedAt).toLocaleDateString("pt-BR")}
                </span>
              )}
            </p>
            {company.performanceInsight ? (
              <>
                <p className="text-sm text-slate-800 leading-relaxed mb-3">
                  {company.performanceInsight}
                </p>
                <form action={generatePerformanceInsightAction.bind(null, id)}>
                  <SubmitButton
                    pendingText="Gerando..."
                    className="text-xs font-medium text-blue-700 hover:underline disabled:no-underline"
                  >
                    Atualizar análise
                  </SubmitButton>
                </form>
              </>
            ) : hasGeminiKey ? (
              <form action={generatePerformanceInsightAction.bind(null, id)}>
                <SubmitButton
                  pendingText="Gerando análise..."
                  className="rounded-lg bg-blue-700 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-800 transition-colors"
                >
                  Gerar análise com o Agente de Performance →
                </SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-slate-500">
                Sem chave de IA configurada — análise automática indisponível.
              </p>
            )}
          </Card>
        )}

        <div className="space-y-4">
          {[...grouped.entries()].map(([key, entries]) => {
            const [areaKey, indicatorName] = key.split("::");
            const areaName = getAreaByKey(areaKey)?.name ?? areaKey;
            const sorted = [...entries].sort((a, b) => b.month.localeCompare(a.month));
            return (
              <Card key={key} className="p-6">
                <p className="text-xs text-slate-500 mb-0.5">{areaName}</p>
                <h2 className="font-semibold text-slate-900 mb-3">{indicatorName}</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 pr-4">Mês</th>
                      <th className="py-1.5 pr-4">Valor</th>
                      <th className="py-1.5 pr-4">Meta</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((entry) => {
                      const hitTarget = entry.target != null ? entry.value >= entry.target : null;
                      return (
                        <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 pr-4 text-slate-700">{entry.month}</td>
                          <td className="py-1.5 pr-4 font-medium text-slate-900">{entry.value}</td>
                          <td className="py-1.5 pr-4">
                            {entry.target != null ? (
                              <span className={hitTarget ? "text-green-700" : "text-red-600"}>
                                {entry.target} {hitTarget ? "✓" : "✗"}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right">
                            <form action={deleteKpiEntry.bind(null, id, entry.id)}>
                              <SubmitButton pendingText="Removendo..." className="text-xs text-red-600 hover:underline disabled:no-underline">
                                Remover
                              </SubmitButton>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            );
          })}
          {company.kpiEntries.length === 0 && (
            <Card className="flex flex-col items-center gap-2 text-center py-12">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum indicador registrado ainda.</p>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
