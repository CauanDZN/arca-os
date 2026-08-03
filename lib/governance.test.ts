import { describe, it, expect } from "vitest";
import { checkFiscalRisk, checkLaborRisk, checkContractCompliance, checkLgpdCompliance } from "@/lib/governance";

describe("checkFiscalRisk", () => {
  it("flags a critical answer on a fiscal-risk question", () => {
    const alerts = checkFiscalRisk([{ areaKey: "fiscal", questionId: "q4", score: 1 }]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].areaKey).toBe("fiscal");
    expect(alerts[0].score).toBe(1);
  });

  it("does not flag a healthy answer", () => {
    const alerts = checkFiscalRisk([{ areaKey: "fiscal", questionId: "q4", score: 4 }]);
    expect(alerts).toHaveLength(0);
  });

  it("ignores fiscal questions outside the curated risk list", () => {
    const alerts = checkFiscalRisk([{ areaKey: "fiscal", questionId: "q1", score: 0 }]);
    expect(alerts).toHaveLength(0);
  });

  it("does not flag an unanswered question", () => {
    expect(checkFiscalRisk([])).toHaveLength(0);
  });
});

describe("checkLaborRisk", () => {
  it("flags a critical answer about riscos trabalhistas", () => {
    const alerts = checkLaborRisk([{ areaKey: "pessoas", questionId: "q12", score: 2 }]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].areaKey).toBe("pessoas");
  });

  it("flags a critical answer about contratos de trabalho", () => {
    const alerts = checkLaborRisk([{ areaKey: "juridico", questionId: "q3", score: 1 }]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].areaKey).toBe("juridico");
  });
});

describe("checkContractCompliance", () => {
  it("flags every curated contractual question that scores low", () => {
    const alerts = checkContractCompliance([
      { areaKey: "juridico", questionId: "q1", score: 1 },
      { areaKey: "juridico", questionId: "q9", score: 2 },
      { areaKey: "juridico", questionId: "q5", score: 0 }, // fora da lista curada (risco judicial, não contratual)
    ]);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.questionText)).not.toContain(undefined);
  });
});

describe("checkLgpdCompliance", () => {
  it("flags missing LGPD policy from the diagnostic answer", () => {
    const alerts = checkLgpdCompliance([{ areaKey: "juridico", questionId: "q6", score: 1 }], []);
    expect(alerts).toEqual([
      expect.objectContaining({ type: "sem_politica", areaName: "Jurídico, Contratos e Compliance" }),
    ]);
  });

  it("flags a sensitive document regardless of the policy answer", () => {
    const alerts = checkLgpdCompliance(
      [{ areaKey: "juridico", questionId: "q6", score: 5 }],
      [{ aiSuggestedCategory: "Folha de pagamento" }, { aiSuggestedCategory: "Contrato" }]
    );
    expect(alerts).toEqual([{ type: "documento_sensivel", documentCount: 1 }]);
  });

  it("returns both alerts when policy is missing and a sensitive document exists", () => {
    const alerts = checkLgpdCompliance(
      [{ areaKey: "juridico", questionId: "q6", score: 0 }],
      [{ aiSuggestedCategory: "Folha de pagamento" }]
    );
    expect(alerts).toHaveLength(2);
  });

  it("returns nothing when there is no gap and no sensitive document", () => {
    const alerts = checkLgpdCompliance([{ areaKey: "juridico", questionId: "q6", score: 5 }], [
      { aiSuggestedCategory: "Contrato" },
    ]);
    expect(alerts).toHaveLength(0);
  });
});
