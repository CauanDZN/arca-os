import { describe, it, expect } from "vitest";
import { buildMonthlyReport, currentPeriod } from "@/lib/monthly-report";
import { AREAS } from "@/lib/areas";

function answersWithScore(score: number) {
  return AREAS.flatMap((area) =>
    area.questions.map((q) => ({ areaKey: area.key, questionId: q.id, score }))
  );
}

const now = new Date("2026-07-31T12:00:00Z");

describe("buildMonthlyReport", () => {
  it("returns null when no answers were given", () => {
    const data = buildMonthlyReport(
      { period: "2026-07", answers: [], tasks: [], decisionsCount: 0, kpiCount: 0 },
      now
    );
    expect(data).toBeNull();
  });

  it("computes score, maturity level and task stats from the snapshot", () => {
    const data = buildMonthlyReport(
      {
        period: "2026-07",
        answers: answersWithScore(3),
        tasks: [
          { id: "t1", title: "A", areaName: "Financeiro", status: "done", dueDate: null, responsible: "Ana" },
          { id: "t2", title: "B", areaName: "Comercial", status: "todo", dueDate: new Date("2026-07-01"), responsible: "" },
          { id: "t3", title: "C", areaName: "Pessoas", status: "doing", dueDate: new Date("2026-08-15"), responsible: "Carlos" },
        ],
        decisionsCount: 4,
        kpiCount: 7,
      },
      now
    );

    expect(data).not.toBeNull();
    expect(data!.period).toBe("2026-07");
    expect(data!.overallAverage).toBe(3);
    expect(data!.overallStatus).toBe("Em estruturação");
    // nota 3 já entra no Nível 4 (limiar: >= 3)
    expect(data!.maturityLevel).toBe(4);
    expect(data!.maturityLabel).toBe("Empresa Gerenciada");
    expect(data!.areaAverages).toHaveLength(AREAS.length);

    // 1 done / 3 total; t2 atrasada e sem responsável; t3 aberta
    expect(data!.taskStats).toEqual({ total: 3, done: 1, pct: 33, overdue: 1, noOwner: 1 });
    expect(data!.pendingCount).toBe(2);
    expect(data!.decisionsCount).toBe(4);
    expect(data!.kpiCount).toBe(7);
  });

  it("maps the 0–5 score to the 5 maturity levels", () => {
    const cases: [number, number, string][] = [
      [0.5, 1, "Empresa Informal"],
      [1.5, 2, "Empresa Operacional"],
      [2.5, 3, "Empresa Estruturada"],
      [3.5, 4, "Empresa Gerenciada"],
      [4.5, 5, "Empresa Escalável"],
    ];
    for (const [avg, level, label] of cases) {
      const data = buildMonthlyReport(
        { period: "2026-07", answers: answersWithScore(avg), tasks: [], decisionsCount: 0, kpiCount: 0 },
        now
      );
      expect(data!.overallAverage).toBe(avg);
      expect(data!.maturityLevel).toBe(level);
      expect(data!.maturityLabel).toBe(label);
    }
  });
});

describe("currentPeriod", () => {
  it("formats YYYY-MM for a given date", () => {
    expect(currentPeriod(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07");
    expect(currentPeriod(new Date("2026-12-31T23:00:00Z"))).toMatch(/^2026-1[12]$/);
  });
});
