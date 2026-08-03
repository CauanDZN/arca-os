import { describe, it, expect } from "vitest";
import { findVerticalSynergies, SYNERGY_RULES } from "@/lib/synergy";

describe("findVerticalSynergies", () => {
  it("returns no alerts when there are no answers", () => {
    expect(findVerticalSynergies([])).toEqual([]);
  });

  it("fires when both sides of a rule are weak", () => {
    const alerts = findVerticalSynergies([
      { areaKey: "financeiro", questionId: "q10", score: 1 },
      { areaKey: "comercial", questionId: "q10", score: 0 },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe("precificacao");
    expect(alerts[0].findings[0].areaKey).toBe("financeiro");
    expect(alerts[0].findings[1].areaKey).toBe("comercial");
    expect(alerts[0].findings[0].score).toBe(1);
  });

  it("does not fire when only one side is weak", () => {
    const alerts = findVerticalSynergies([
      { areaKey: "financeiro", questionId: "q10", score: 1 },
      { areaKey: "comercial", questionId: "q10", score: 5 },
    ]);
    expect(alerts).toEqual([]);
  });

  it("does not fire when one side was never answered", () => {
    const alerts = findVerticalSynergies([{ areaKey: "financeiro", questionId: "q10", score: 0 }]);
    expect(alerts).toEqual([]);
  });

  it("does not fire on scores right at the edge of the threshold (3 is not weak)", () => {
    const alerts = findVerticalSynergies([
      { areaKey: "financeiro", questionId: "q10", score: 3 },
      { areaKey: "comercial", questionId: "q10", score: 2 },
    ]);
    expect(alerts).toEqual([]);
  });

  it("every rule references a question that actually exists", () => {
    // resolveFinding só devolve algo quando getAreaByKey + questions.find
    // acham a pergunta — se um id estiver errado, o alerta nunca dispara em
    // produção mesmo com as duas notas fracas. Testa isso de verdade, não só
    // que o array de regras "parece" bem formado.
    for (const rule of SYNERGY_RULES) {
      const alerts = findVerticalSynergies([
        { areaKey: rule.targetA.areaKey, questionId: rule.targetA.questionId, score: 0 },
        { areaKey: rule.targetB.areaKey, questionId: rule.targetB.questionId, score: 0 },
      ]);
      expect(alerts.map((a) => a.key)).toContain(rule.key);
    }
  });

  it("can fire multiple rules at once", () => {
    const alerts = findVerticalSynergies([
      { areaKey: "financeiro", questionId: "q10", score: 0 },
      { areaKey: "comercial", questionId: "q10", score: 0 },
      { areaKey: "pessoas", questionId: "q1", score: 0 },
      { areaKey: "estrategia", questionId: "q4", score: 0 },
    ]);
    expect(alerts.map((a) => a.key).sort()).toEqual(["dependencia_dono", "precificacao"]);
  });
});
