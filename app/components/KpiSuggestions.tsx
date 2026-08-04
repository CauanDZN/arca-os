"use client";

import type { KpiTargetSuggestion } from "@/lib/kpi-targets";

/**
 * Metas do plano estratégico, agrupadas por vertical, como chips clicáveis
 * acima do form de indicador do Cockpit de Performance. Usa querySelector em
 * vez de virar o form inteiro num componente controlado — os campos
 * `indicator`/`target` continuam simples <select>/<input> renderizados no
 * servidor, este componente só os preenche por fora ao clicar num chip.
 * Sugestão "delta" preenche só o indicador (não dá pra transformar variação
 * relativa em meta absoluta sem saber a linha de base — ver lib/kpi-targets.ts).
 */
export function KpiSuggestions({
  suggestionsByVertical,
}: {
  suggestionsByVertical: { verticalName: string; suggestions: KpiTargetSuggestion[] }[];
}) {
  if (suggestionsByVertical.length === 0) return null;

  function apply(s: KpiTargetSuggestion) {
    const select = document.querySelector<HTMLSelectElement>('select[name="indicator"]');
    const target = document.querySelector<HTMLInputElement>('input[name="target"]');
    if (select) select.value = `${s.areaKey}::${s.indicatorName}`;
    if (target) target.value = s.kind === "nivel" && s.value != null ? String(s.value) : "";
  }

  return (
    <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3 -mt-1">
      <p className="text-xs font-medium text-blue-800 mb-2">
        Metas do plano estratégico por vertical — clique pra usar. Chips claros preenchem indicador
        e meta; chips com asterisco só preenchem o indicador (meta é uma variação relativa, calcule
        o valor absoluto a partir do mês atual).
      </p>
      <div className="space-y-2">
        {suggestionsByVertical.map(({ verticalName, suggestions }) => (
          <div key={verticalName}>
            <p className="text-[11px] font-semibold text-blue-900/70 uppercase tracking-wide mb-1">{verticalName}</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={`${s.areaKey}::${s.indicatorName}`}
                  type="button"
                  onClick={() => apply(s)}
                  title={s.kind === "delta" ? "Meta relativa do plano — calcule o valor absoluto antes de salvar" : "Preenche indicador e meta automaticamente"}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    s.kind === "nivel"
                      ? "border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                      : "border-blue-200 bg-white/60 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {s.indicatorName} · {s.label}
                  {s.kind === "delta" && "*"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
