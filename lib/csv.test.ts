import { describe, it, expect } from "vitest";
import { reportAreasToCsv, kpiEntriesToCsv } from "@/lib/csv";
import { buildReport } from "@/lib/scoring";
import { AREAS } from "@/lib/areas";

describe("reportAreasToCsv", () => {
  it("produces a header row plus one row per area, with score/status/classification", () => {
    const report = buildReport([]);
    const csv = reportAreasToCsv(report);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("Área,Nota,Status,Classificação");
    expect(lines).toHaveLength(AREAS.length + 1);
    // an all-empty diagnostic scores 0 everywhere → Crítico / Estrutural.
    // AREAS[0].name itself contains a comma, so the CSV cell is quoted.
    expect(lines[1]).toBe(`"${AREAS[0].name}",0.0,Crítico,Estrutural`);
  });

  it("quotes area names that contain commas", () => {
    const report = buildReport([]);
    const csv = reportAreasToCsv(report);
    // area names in this app use "," (e.g. "Direção, Estratégia e Governança")
    expect(csv).toContain(`"${AREAS[0].name}"`);
  });
});

describe("kpiEntriesToCsv", () => {
  it("produces a header row plus one row per entry", () => {
    const csv = kpiEntriesToCsv([
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-07", value: 310000, target: 350000 },
      { areaName: "Comercial e Vendas", indicatorName: "Ticket médio", month: "2026-07", value: 168.5 },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Área,Indicador,Mês,Valor,Meta");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("Financeiro e Controladoria,Receita mensal,2026-07,310000,350000");
    // no target set — the Meta cell is blank, not "0" or "null"
    expect(lines[2]).toBe("Comercial e Vendas,Ticket médio,2026-07,168.5,");
  });

  it("returns just the header for an empty list", () => {
    const csv = kpiEntriesToCsv([]);
    expect(csv).toBe("Área,Indicador,Mês,Valor,Meta");
  });
});
