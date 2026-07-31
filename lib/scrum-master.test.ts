import { describe, it, expect } from "vitest";
import { findScrumIssues } from "@/lib/scrum-master";

const now = new Date("2026-07-30T12:00:00Z");

describe("findScrumIssues", () => {
  it("flags an overdue sprint that isn't 100% done", () => {
    const result = findScrumIssues(
      [{ id: "s1", name: "Sprint 1", endDate: new Date("2026-07-01") }],
      [{ id: "t1", title: "Ação", areaName: "Financeiro", status: "doing", sprintId: "s1", updatedAt: now }],
      now
    );
    expect(result.overdueSprints).toHaveLength(1);
    expect(result.overdueSprints[0]).toMatchObject({ sprintId: "s1", pct: 0 });
  });

  it("does not flag an overdue sprint that is 100% done", () => {
    const result = findScrumIssues(
      [{ id: "s1", name: "Sprint 1", endDate: new Date("2026-07-01") }],
      [{ id: "t1", title: "Ação", areaName: "Financeiro", status: "done", sprintId: "s1", updatedAt: now }],
      now
    );
    expect(result.overdueSprints).toHaveLength(0);
  });

  it("does not flag a sprint that hasn't ended yet", () => {
    const result = findScrumIssues(
      [{ id: "s1", name: "Sprint 1", endDate: new Date("2026-12-01") }],
      [{ id: "t1", title: "Ação", areaName: "Financeiro", status: "todo", sprintId: "s1", updatedAt: now }],
      now
    );
    expect(result.overdueSprints).toHaveLength(0);
  });

  it("flags a sprint with no tasks assigned, instead of treating it as overdue", () => {
    const result = findScrumIssues(
      [{ id: "s1", name: "Sprint Vazio", endDate: new Date("2026-07-01") }],
      [],
      now
    );
    expect(result.emptySprints).toHaveLength(1);
    expect(result.overdueSprints).toHaveLength(0);
  });

  it("flags an open task that hasn't moved in 14+ days", () => {
    const result = findScrumIssues(
      [],
      [
        {
          id: "t1",
          title: "Parada",
          areaName: "Comercial",
          status: "doing",
          sprintId: null,
          updatedAt: new Date("2026-07-01"),
        },
      ],
      now
    );
    expect(result.stuckTasks).toHaveLength(1);
    expect(result.stuckTasks[0].daysSinceUpdate).toBeGreaterThanOrEqual(14);
  });

  it("does not flag a done task as stuck, even if untouched for a long time", () => {
    const result = findScrumIssues(
      [],
      [
        {
          id: "t1",
          title: "Feita há tempos",
          areaName: "Comercial",
          status: "done",
          sprintId: null,
          updatedAt: new Date("2026-01-01"),
        },
      ],
      now
    );
    expect(result.stuckTasks).toHaveLength(0);
  });

  it("does not flag a task updated recently", () => {
    const result = findScrumIssues(
      [],
      [
        {
          id: "t1",
          title: "Recente",
          areaName: "Comercial",
          status: "todo",
          sprintId: null,
          updatedAt: new Date("2026-07-25"),
        },
      ],
      now
    );
    expect(result.stuckTasks).toHaveLength(0);
  });
});
