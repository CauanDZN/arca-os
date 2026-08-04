import { describe, it, expect } from "vitest";
import { determineServiceTierLevel, getServiceTier, SERVICE_TIER_LEVELS } from "@/lib/service-tier";

describe("determineServiceTierLevel", () => {
  it("sem diagnóstico concluído fica no Nível 1, mesmo com plano/kpi (dado inconsistente)", () => {
    expect(
      determineServiceTierLevel({ hasCompletedDiagnostic: false, hasApprovedPlan: true, hasKpiTracking: true })
    ).toBe(1);
  });

  it("diagnóstico concluído sem plano aprovado fica no Nível 1", () => {
    expect(
      determineServiceTierLevel({ hasCompletedDiagnostic: true, hasApprovedPlan: false, hasKpiTracking: false })
    ).toBe(1);
  });

  it("plano aprovado sem indicadores é Nível 2 (Execução)", () => {
    expect(
      determineServiceTierLevel({ hasCompletedDiagnostic: true, hasApprovedPlan: true, hasKpiTracking: false })
    ).toBe(2);
  });

  it("plano aprovado com indicadores sendo medidos é Nível 3 (Performance)", () => {
    expect(
      determineServiceTierLevel({ hasCompletedDiagnostic: true, hasApprovedPlan: true, hasKpiTracking: true })
    ).toBe(3);
  });

  it("nunca retorna Nível 4 — não é detectável automaticamente", () => {
    const combos = [
      { hasCompletedDiagnostic: true, hasApprovedPlan: true, hasKpiTracking: true },
      { hasCompletedDiagnostic: false, hasApprovedPlan: false, hasKpiTracking: false },
      { hasCompletedDiagnostic: true, hasApprovedPlan: false, hasKpiTracking: true },
    ];
    for (const combo of combos) {
      expect(determineServiceTierLevel(combo)).not.toBe(4);
    }
  });
});

describe("getServiceTier", () => {
  it("retorna label e descrição pra cada um dos 4 níveis", () => {
    for (const level of SERVICE_TIER_LEVELS) {
      const tier = getServiceTier(level);
      expect(tier.level).toBe(level);
      expect(tier.label.length).toBeGreaterThan(0);
      expect(tier.description.length).toBeGreaterThan(0);
    }
  });
});
