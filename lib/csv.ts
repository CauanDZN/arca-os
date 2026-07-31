import type { Report } from "@/lib/scoring";

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

/**
 * Flat, BI-tool-friendly export of a diagnostic's area scores — one row per
 * area, ready to import into Power BI / Looker Studio / Excel.
 */
export function reportAreasToCsv(report: Report): string {
  const classificationByArea = new Map(report.priorityMatrix.map((p) => [p.areaKey, p.classification]));
  const rows = report.areaScores.map((a) => [
    a.area.name,
    a.average.toFixed(1),
    a.status,
    classificationByArea.get(a.area.key) ?? "",
  ]);
  return toCsv(["Área", "Nota", "Status", "Classificação"], rows);
}

export type KpiEntryLike = {
  areaName: string;
  indicatorName: string;
  month: string;
  value: number;
  target?: number | null;
};

/** Time-series export of manually-entered KPIs, one row per entry. */
export function kpiEntriesToCsv(entries: KpiEntryLike[]): string {
  const rows = entries.map((e) => [e.areaName, e.indicatorName, e.month, e.value, e.target ?? ""]);
  return toCsv(["Área", "Indicador", "Mês", "Valor", "Meta"], rows);
}
