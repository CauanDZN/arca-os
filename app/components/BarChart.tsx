const STATUS_BAR_CLASS: Record<string, string> = {
  Crítico: "bg-status-critical",
  Frágil: "bg-status-serious",
  "Em estruturação": "bg-status-warning",
  Gerenciado: "bg-status-managed",
  Otimizado: "bg-status-good",
};

export type BarChartItem = {
  label: string;
  value: number;
  max?: number;
  status?: string;
  display?: string;
};

// Barra horizontal simples (CSS puro, sem lib de gráficos) — usada nos
// dashboards para notas de maturidade, execução, segmentos etc.
export function BarChart({
  items,
  max = 5,
  className,
}: {
  items: BarChartItem[];
  max?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {items.map((item) => {
        const itemMax = item.max ?? max;
        const pct = Math.max(0, Math.min(100, (item.value / Math.max(itemMax, 0.0001)) * 100));
        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm text-slate-700 truncate" title={item.label}>
                {item.label}
              </span>
              <span className="text-sm font-semibold text-slate-900 shrink-0">
                {item.display ?? item.value.toFixed(1)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.status ? (STATUS_BAR_CLASS[item.status] ?? "bg-status-managed") : "bg-status-managed"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
