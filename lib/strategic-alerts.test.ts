import { describe, it, expect } from "vitest";
import { findKpiAlerts } from "@/lib/strategic-alerts";

describe("findKpiAlerts", () => {
  it("flags a drop of at least the threshold between the two most recent months", () => {
    const alerts = findKpiAlerts([
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-06", value: 100000 },
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-07", value: 80000 },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ direction: "queda", changePct: -20 });
  });

  it("flags a rise the same way", () => {
    const alerts = findKpiAlerts([
      { areaName: "Comercial e Vendas", indicatorName: "Ticket médio", month: "2026-06", value: 100 },
      { areaName: "Comercial e Vendas", indicatorName: "Ticket médio", month: "2026-07", value: 130 },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ direction: "alta", changePct: 30 });
  });

  it("does not flag a move below the threshold", () => {
    const alerts = findKpiAlerts([
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-06", value: 100000 },
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-07", value: 95000 },
    ]);
    expect(alerts).toHaveLength(0);
  });

  it("needs at least two data points for the same indicator", () => {
    const alerts = findKpiAlerts([
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-07", value: 100000 },
    ]);
    expect(alerts).toHaveLength(0);
  });

  it("compares the two most recent months, ignoring older history", () => {
    const alerts = findKpiAlerts([
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-01", value: 10 },
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-06", value: 100000 },
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-07", value: 99000 },
    ]);
    // Jan -> Jun would be a huge jump, but only Jun -> Jul (a small move) should be evaluated
    expect(alerts).toHaveLength(0);
  });

  it("evaluates each indicator independently", () => {
    const alerts = findKpiAlerts([
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-06", value: 100000 },
      { areaName: "Financeiro e Controladoria", indicatorName: "Receita mensal", month: "2026-07", value: 80000 },
      { areaName: "Financeiro e Controladoria", indicatorName: "Margem bruta", month: "2026-06", value: 30 },
      { areaName: "Financeiro e Controladoria", indicatorName: "Margem bruta", month: "2026-07", value: 31 },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].indicatorName).toBe("Receita mensal");
  });

  it("skips a series whose previous value is zero to avoid a divide-by-zero spike", () => {
    const alerts = findKpiAlerts([
      { areaName: "Comercial e Vendas", indicatorName: "Churn/cancelamento", month: "2026-06", value: 0 },
      { areaName: "Comercial e Vendas", indicatorName: "Churn/cancelamento", month: "2026-07", value: 5 },
    ]);
    expect(alerts).toHaveLength(0);
  });
});
