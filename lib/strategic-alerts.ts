export type KpiAlert = {
  areaName: string;
  indicatorName: string;
  fromMonth: string;
  toMonth: string;
  fromValue: number;
  toValue: number;
  changePct: number;
  direction: "queda" | "alta";
};

type KpiPoint = {
  areaName: string;
  indicatorName: string;
  month: string;
  value: number;
};

/**
 * Agente de Alertas Estratégicos: pure rule, no AI. Flags the most recent
 * month-over-month move for each indicator when it crosses the threshold —
 * a real signal (like the margin-fell-while-revenue-rose example from the
 * pitch), not a narrative.
 */
export function findKpiAlerts(entries: KpiPoint[], thresholdPct = 15): KpiAlert[] {
  const byIndicator = new Map<string, KpiPoint[]>();
  for (const entry of entries) {
    const key = `${entry.areaName}::${entry.indicatorName}`;
    byIndicator.set(key, [...(byIndicator.get(key) ?? []), entry]);
  }

  const alerts: KpiAlert[] = [];

  for (const series of byIndicator.values()) {
    const sorted = [...series].sort((a, b) => a.month.localeCompare(b.month));
    if (sorted.length < 2) continue;

    const previous = sorted[sorted.length - 2];
    const current = sorted[sorted.length - 1];
    if (previous.value === 0) continue; // avoid divide-by-zero / infinite % noise

    const changePct = ((current.value - previous.value) / Math.abs(previous.value)) * 100;
    if (Math.abs(changePct) < thresholdPct) continue;

    alerts.push({
      areaName: current.areaName,
      indicatorName: current.indicatorName,
      fromMonth: previous.month,
      toMonth: current.month,
      fromValue: previous.value,
      toValue: current.value,
      changePct: Math.round(changePct * 10) / 10,
      direction: changePct < 0 ? "queda" : "alta",
    });
  }

  return alerts;
}
