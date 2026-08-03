import { describe, it, expect } from "vitest";
import { buildVerticalReport } from "@/lib/vertical-diagnostic";
import { getVerticalByKey } from "@/lib/verticals";
import { getAreaByKey } from "@/lib/areas";

const financeiro = getVerticalByKey("financeiro")!; // 1 área só (financeiro)
const comercial = getVerticalByKey("comercial")!; // 2 áreas (comercial, atendimento)
const marketing = getVerticalByKey("marketing")!; // 1 área só (marketing) — separada de Comercial
const financeiroArea = getAreaByKey("financeiro")!;

describe("buildVerticalReport — vertical de 1 área só (Financeiro)", () => {
  it("computes the average from only that vertical's answers, not diluted by other areas", () => {
    const answers = financeiroArea.questions.map((q) => ({
      areaKey: "financeiro",
      questionId: q.id,
      score: 4,
    }));
    const report = buildVerticalReport(financeiro, answers);

    expect(report.average).toBe(4);
    expect(report.status).toBe("Gerenciado");
    expect(report.verticalKey).toBe("financeiro");
    expect(report.verticalName).toBe(financeiro.name);
  });

  it("returns 0 and one generic action item when there are no answers", () => {
    const report = buildVerticalReport(financeiro, []);
    expect(report.average).toBe(0);
    expect(report.status).toBe("Crítico");
    expect(report.actionItems).toHaveLength(1);
    expect(report.actionItems[0].problem).toContain(financeiro.name);
  });
});

describe("buildVerticalReport — vertical com múltiplas áreas (Comercial)", () => {
  it("blends answers from both areas into a single average", () => {
    const comercialArea = getAreaByKey("comercial")!;
    const atendimentoArea = getAreaByKey("atendimento")!;

    const answers = [
      { areaKey: "comercial", questionId: comercialArea.questions[0].id, score: 5 },
      { areaKey: "atendimento", questionId: atendimentoArea.questions[0].id, score: 1 },
    ];
    const report = buildVerticalReport(comercial, answers);

    expect(report.average).toBe(3); // (5+1)/2
    expect(report.verticalKey).toBe("comercial");
  });

  it("tags each weak question with its own area, not the vertical's first area", () => {
    const comercialArea = getAreaByKey("comercial")!;
    const atendimentoArea = getAreaByKey("atendimento")!;

    const answers = [
      { areaKey: "comercial", questionId: comercialArea.questions[1].id, score: 1 },
      { areaKey: "atendimento", questionId: atendimentoArea.questions[0].id, score: 2 },
    ];
    const report = buildVerticalReport(comercial, answers);

    expect(report.weakestQuestions.map((w) => w.areaKey).sort()).toEqual(["atendimento", "comercial"]);
    expect(report.actionItems.map((a) => a.areaKey).sort()).toEqual(["atendimento", "comercial"]);
  });

  it("caps weakest questions at 5, sorted ascending by score", () => {
    const comercialArea = getAreaByKey("comercial")!;
    const answers = comercialArea.questions.slice(0, 6).map((q, i) => ({
      areaKey: "comercial",
      questionId: q.id,
      score: i % 3, // 0,1,2,0,1,2 — todas <= 2, então todas qualificam como "fracas"
    }));
    const report = buildVerticalReport(comercial, answers);
    expect(report.weakestQuestions).toHaveLength(5);
    expect(report.weakestQuestions.map((w) => w.score)).toEqual([0, 0, 1, 1, 2]);
  });
});

describe("buildVerticalReport — vertical de 1 área só (Marketing, separada de Comercial)", () => {
  it("computes the average from only marketing answers", () => {
    const marketingArea = getAreaByKey("marketing")!;
    const answers = marketingArea.questions.map((q) => ({
      areaKey: "marketing",
      questionId: q.id,
      score: 3,
    }));
    const report = buildVerticalReport(marketing, answers);

    expect(report.average).toBe(3);
    expect(report.verticalKey).toBe("marketing");
    expect(report.verticalName).toBe(marketing.name);
  });
});
