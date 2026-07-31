import { describe, it, expect } from "vitest";
import {
  buildReport,
  maturityLevelForScore,
  statusForScore,
  type AnswerInput,
} from "@/lib/scoring";
import { AREAS } from "@/lib/areas";

describe("statusForScore", () => {
  it("classifies boundaries correctly", () => {
    expect(statusForScore(0)).toBe("Crítico");
    expect(statusForScore(1.49)).toBe("Crítico");
    expect(statusForScore(1.5)).toBe("Frágil");
    expect(statusForScore(2.49)).toBe("Frágil");
    expect(statusForScore(2.5)).toBe("Em estruturação");
    expect(statusForScore(3.49)).toBe("Em estruturação");
    expect(statusForScore(3.5)).toBe("Gerenciado");
    expect(statusForScore(4.49)).toBe("Gerenciado");
    expect(statusForScore(4.5)).toBe("Otimizado");
    expect(statusForScore(5)).toBe("Otimizado");
  });
});

describe("maturityLevelForScore", () => {
  it("maps 0–5 into the 5 pitch levels (Empresa informal → Escalável)", () => {
    expect(maturityLevelForScore(0).level).toBe(1);
    expect(maturityLevelForScore(0.9).label).toBe("Empresa Informal");

    expect(maturityLevelForScore(1).level).toBe(2);
    expect(maturityLevelForScore(1.9).label).toBe("Empresa Operacional");

    expect(maturityLevelForScore(2).level).toBe(3);
    expect(maturityLevelForScore(2.9).label).toBe("Empresa Estruturada");

    expect(maturityLevelForScore(3).level).toBe(4);
    expect(maturityLevelForScore(3.9).label).toBe("Empresa Gerenciada");

    expect(maturityLevelForScore(4).level).toBe(5);
    expect(maturityLevelForScore(5).label).toBe("Empresa Escalável");
  });

  it("exposes exactly 5 levels in order", () => {
    const levels = [1, 2, 3, 4, 5].map((n) => maturityLevelForScore(n - 0.5));
    expect(levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
  });
});

function answersWithScore(score: number): AnswerInput[] {
  return AREAS.flatMap((area) =>
    area.questions.map((q) => ({ areaKey: area.key, questionId: q.id, score }))
  );
}

describe("buildReport", () => {
  it("covers all 12 areas even with no answers at all", () => {
    const report = buildReport([]);
    expect(report.areaScores).toHaveLength(12);
    expect(report.areaScores.every((a) => a.average === 0)).toBe(true);
    expect(report.overallAverage).toBe(0);
    expect(report.overallStatus).toBe("Crítico");
  });

  it("generates a fallback action item per area when there are no explicit weak questions", () => {
    const report = buildReport([]);
    // no answers -> weakestQuestions is empty per area -> single fallback item per area
    const totalActions =
      report.actionPlan.days30.length +
      report.actionPlan.days90.length +
      report.actionPlan.months12.length;
    expect(totalActions).toBe(12);
    expect(report.actionPlan.days30[0].problem).toMatch(/^Melhoria geral em/);
  });

  it("treats an all-zero explicit diagnostic as fully critical with 3 gaps per area", () => {
    const report = buildReport(answersWithScore(0));
    expect(report.overallAverage).toBe(0);
    expect(report.overallStatus).toBe("Crítico");
    expect(report.areaScores.every((a) => a.status === "Crítico")).toBe(true);
    expect(report.priorityMatrix.every((p) => p.classification === "Estrutural")).toBe(true);

    // every area contributes up to 3 weakest questions (real question text, not the fallback)
    const totalActions =
      report.actionPlan.days30.length +
      report.actionPlan.days90.length +
      report.actionPlan.months12.length;
    expect(totalActions).toBe(12 * 3);
    expect(report.actionPlan.days30.every((a) => a.priority === "Alta")).toBe(true);
    expect(report.actionPlan.days90).toHaveLength(0);
    expect(report.actionPlan.months12).toHaveLength(0);
  });

  it("treats a perfect diagnostic as optimized with an empty action plan", () => {
    const report = buildReport(answersWithScore(5));
    expect(report.overallAverage).toBe(5);
    expect(report.overallStatus).toBe("Otimizado");
    expect(report.maturityLevel).toBe(5);
    expect(report.maturityLabel).toBe("Empresa Escalável");
    expect(report.areaScores.every((a) => a.status === "Otimizado")).toBe(true);
    expect(report.priorityMatrix.every((p) => p.classification === "Não prioritária")).toBe(true);
    expect(report.actionPlan.days30).toHaveLength(0);
    expect(report.actionPlan.days90).toHaveLength(0);
    expect(report.actionPlan.months12).toHaveLength(0);
  });

  it("identifies strengths and risks correctly in a mixed scenario", () => {
    const answers: AnswerInput[] = AREAS.flatMap((area) =>
      area.questions.map((q) => ({
        areaKey: area.key,
        questionId: q.id,
        // "estrategia" area scores perfectly, everything else scores 0
        score: area.key === "estrategia" ? 5 : 0,
      }))
    );
    const report = buildReport(answers);

    expect(report.strengths[0].area.key).toBe("estrategia");
    expect(report.strengths[0].average).toBe(5);
    expect(report.risks.every((r) => r.average === 0)).toBe(true);
    expect(report.risks.some((r) => r.area.key === "estrategia")).toBe(false);
  });

  it("classifies mid-range scores as Corretiva for risk-sensitive areas and Quick Win otherwise", () => {
    const answers: AnswerInput[] = AREAS.flatMap((area) => {
      // 3.0 average lands in the [2.5, 3.5) classify bucket
      const score = 3;
      return area.questions.map((q) => ({ areaKey: area.key, questionId: q.id, score }));
    });
    const report = buildReport(answers);

    const fiscal = report.priorityMatrix.find((p) => p.areaKey === "fiscal");
    const comercial = report.priorityMatrix.find((p) => p.areaKey === "comercial");
    expect(fiscal?.classification).toBe("Corretiva");
    expect(comercial?.classification).toBe("Quick Win");
  });

  it("buckets action items into the correct timeframe by score", () => {
    const answers: AnswerInput[] = AREAS.flatMap((area) => {
      // "estrategia" scores 1 (< 2 -> 30 dias), everything else scores 3 (31 a 90 dias)
      const score = area.key === "estrategia" ? 1 : 3;
      return area.questions.map((q) => ({ areaKey: area.key, questionId: q.id, score }));
    });
    const report = buildReport(answers);

    expect(report.actionPlan.days30.length).toBeGreaterThan(0);
    expect(report.actionPlan.days30.every((a) => a.areaKey === "estrategia")).toBe(true);
    expect(report.actionPlan.days90.length).toBeGreaterThan(0);
    expect(report.actionPlan.days90.every((a) => a.areaKey !== "estrategia")).toBe(true);
  });

  it("rounds averages to one decimal place", () => {
    // 3 answers with scores 1, 2, 2 -> average 1.666... -> rounds to 1.7
    const area = AREAS[0];
    const answers: AnswerInput[] = [
      { areaKey: area.key, questionId: area.questions[0].id, score: 1 },
      { areaKey: area.key, questionId: area.questions[1].id, score: 2 },
      { areaKey: area.key, questionId: area.questions[2].id, score: 2 },
    ];
    const report = buildReport(answers);
    const scored = report.areaScores.find((a) => a.area.key === area.key);
    expect(scored?.average).toBe(1.7);
  });
});
