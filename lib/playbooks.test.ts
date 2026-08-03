import { describe, it, expect } from "vitest";
import { PLAYBOOKS, getPlaybookByVertical } from "@/lib/playbooks";
import { VERTICALS } from "@/lib/verticals";

describe("playbooks", () => {
  it("has exactly one playbook per vertical", () => {
    expect(PLAYBOOKS).toHaveLength(VERTICALS.length);
    for (const vertical of VERTICALS) {
      const matches = PLAYBOOKS.filter((p) => p.verticalKey === vertical.key);
      expect(matches).toHaveLength(1);
    }
  });

  it("every playbook has a summary and at least 3 steps", () => {
    for (const playbook of PLAYBOOKS) {
      expect(playbook.summary.length).toBeGreaterThan(0);
      expect(playbook.steps.length).toBeGreaterThanOrEqual(3);
      for (const step of playbook.steps) {
        expect(step.length).toBeGreaterThan(0);
      }
    }
  });

  it("getPlaybookByVertical resolves a known vertical and returns undefined for an unknown one", () => {
    expect(getPlaybookByVertical("financeiro")?.steps.length).toBeGreaterThan(0);
    expect(getPlaybookByVertical("inexistente")).toBeUndefined();
  });
});
