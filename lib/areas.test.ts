import { describe, it, expect } from "vitest";
import { AREAS, OBJECTIVES, getAreaByKey, getAreaIndex, getResumeAreaKey } from "@/lib/areas";

describe("AREAS", () => {
  it("has exactly the 12 areas from the pitch", () => {
    expect(AREAS).toHaveLength(12);
  });

  it("has unique keys", () => {
    const keys = AREAS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has non-empty name, objective, indicators and questions for every area", () => {
    for (const area of AREAS) {
      expect(area.name.length).toBeGreaterThan(0);
      expect(area.objective.length).toBeGreaterThan(0);
      expect(area.indicators.length).toBeGreaterThan(0);
      expect(area.questions.length).toBeGreaterThan(0);
    }
  });

  it("has unique question ids within each area", () => {
    for (const area of AREAS) {
      const ids = area.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("has ~140 questions in total, matching the pitch document", () => {
    const total = AREAS.reduce((sum, a) => sum + a.questions.length, 0);
    expect(total).toBeGreaterThanOrEqual(130);
    expect(total).toBeLessThanOrEqual(150);
  });

  it("every question text ends with a question mark", () => {
    for (const area of AREAS) {
      for (const q of area.questions) {
        expect(q.text.trim().endsWith("?")).toBe(true);
      }
    }
  });
});

describe("getAreaByKey", () => {
  it("returns the matching area", () => {
    expect(getAreaByKey("financeiro")?.name).toBe("Financeiro e Controladoria");
  });

  it("returns undefined for an unknown key", () => {
    expect(getAreaByKey("area-que-nao-existe")).toBeUndefined();
  });
});

describe("getAreaIndex", () => {
  it("returns the correct 0-based index", () => {
    expect(getAreaIndex(AREAS[0].key)).toBe(0);
    expect(getAreaIndex(AREAS[11].key)).toBe(11);
  });

  it("returns -1 for an unknown key", () => {
    expect(getAreaIndex("area-que-nao-existe")).toBe(-1);
  });
});

describe("OBJECTIVES", () => {
  it("has the 10 objectives from the pitch, all unique", () => {
    expect(OBJECTIVES).toHaveLength(10);
    expect(new Set(OBJECTIVES).size).toBe(10);
  });
});

describe("getResumeAreaKey", () => {
  it("returns the first area for a diagnostic with no answers (the reported 404 bug)", () => {
    expect(getResumeAreaKey([])).toBe(AREAS[0].key);
  });

  it("returns the first area not yet fully answered", () => {
    const firstArea = AREAS[0];
    const answered = firstArea.questions.map(() => ({ areaKey: firstArea.key }));
    expect(getResumeAreaKey(answered)).toBe(AREAS[1].key);
  });

  it("returns the partially answered area when only some of its questions are covered", () => {
    const firstArea = AREAS[0];
    const answered = firstArea.questions.slice(0, 3).map(() => ({ areaKey: firstArea.key }));
    expect(getResumeAreaKey(answered)).toBe(firstArea.key);
  });

  it("returns the last area when every area is fully answered", () => {
    const answered = AREAS.flatMap((a) => a.questions.map(() => ({ areaKey: a.key })));
    expect(getResumeAreaKey(answered)).toBe(AREAS[AREAS.length - 1].key);
  });
});
