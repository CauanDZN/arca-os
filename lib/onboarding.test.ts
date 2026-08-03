import { describe, it, expect } from "vitest";
import { buildOnboardingChecklist } from "@/lib/onboarding";

describe("buildOnboardingChecklist", () => {
  it("marks everything pending for a brand-new company", () => {
    const items = buildOnboardingChecklist({
      onboardingResponsible: "",
      documentCount: 0,
      diagnosticCount: 0,
      hasCompletedDiagnostic: false,
    });

    expect(items.find((i) => i.key === "cadastro")?.done).toBe(true);
    expect(items.find((i) => i.key === "responsavel")?.done).toBe(false);
    expect(items.find((i) => i.key === "data_room")?.done).toBe(false);
    expect(items.find((i) => i.key === "diagnostico_iniciado")?.done).toBe(false);
    expect(items.find((i) => i.key === "diagnostico_concluido")?.done).toBe(false);
  });

  it("treats a whitespace-only responsible as not set", () => {
    const items = buildOnboardingChecklist({
      onboardingResponsible: "   ",
      documentCount: 0,
      diagnosticCount: 0,
      hasCompletedDiagnostic: false,
    });
    expect(items.find((i) => i.key === "responsavel")?.done).toBe(false);
  });

  it("marks everything done for a fully onboarded company", () => {
    const items = buildOnboardingChecklist({
      onboardingResponsible: "Ana Consultora",
      documentCount: 3,
      diagnosticCount: 1,
      hasCompletedDiagnostic: true,
    });
    expect(items.every((i) => i.done)).toBe(true);
  });

  it("keeps diagnóstico iniciado true even when nenhum diagnóstico concluiu ainda", () => {
    const items = buildOnboardingChecklist({
      onboardingResponsible: "Ana",
      documentCount: 1,
      diagnosticCount: 1,
      hasCompletedDiagnostic: false,
    });
    expect(items.find((i) => i.key === "diagnostico_iniciado")?.done).toBe(true);
    expect(items.find((i) => i.key === "diagnostico_concluido")?.done).toBe(false);
  });
});
