import { describe, it, expect } from "vitest";
import { findEvidenceGaps } from "@/lib/audit";
import { AREAS } from "@/lib/areas";

const area = AREAS[0];
const q1 = area.questions[0].id;
const q2 = area.questions[1].id;

describe("findEvidenceGaps", () => {
  it("flags a critical answer with no evidence", () => {
    const alerts = findEvidenceGaps([
      { areaKey: area.key, questionId: q1, score: 1, evidence: "" },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].areaKey).toBe(area.key);
    expect(alerts[0].score).toBe(1);
  });

  it("does not flag a critical answer that has evidence", () => {
    const alerts = findEvidenceGaps([
      { areaKey: area.key, questionId: q1, score: 1, evidence: "print do sistema anexado" },
    ]);
    expect(alerts).toHaveLength(0);
  });

  it("does not flag a healthy answer even without evidence", () => {
    const alerts = findEvidenceGaps([
      { areaKey: area.key, questionId: q1, score: 4, evidence: "" },
    ]);
    expect(alerts).toHaveLength(0);
  });

  it("treats whitespace-only evidence as missing", () => {
    const alerts = findEvidenceGaps([
      { areaKey: area.key, questionId: q1, score: 2, evidence: "   " },
    ]);
    expect(alerts).toHaveLength(1);
  });

  it("handles multiple answers independently", () => {
    const alerts = findEvidenceGaps([
      { areaKey: area.key, questionId: q1, score: 0, evidence: "" },
      { areaKey: area.key, questionId: q2, score: 5, evidence: "" },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].questionText).toBe(area.questions[0].text);
  });
});
