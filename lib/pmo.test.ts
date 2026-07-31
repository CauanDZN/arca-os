import { describe, it, expect } from "vitest";
import { findAtRiskTasks } from "@/lib/pmo";

const now = new Date("2026-07-30T12:00:00Z");

function task(overrides: Partial<Parameters<typeof findAtRiskTasks>[0][number]> = {}) {
  return {
    id: "t1",
    title: "Ação de teste",
    areaName: "Financeiro e Controladoria",
    status: "todo",
    dueDate: null,
    responsible: "",
    ...overrides,
  };
}

describe("findAtRiskTasks", () => {
  it("flags an open task with a past due date as atrasada", () => {
    const alerts = findAtRiskTasks(
      [task({ dueDate: new Date("2026-07-01"), responsible: "Ana" })],
      now
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].reason).toBe("atrasada");
  });

  it("flags an open task with no responsible as sem_responsavel", () => {
    const alerts = findAtRiskTasks([task({ responsible: "" })], now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].reason).toBe("sem_responsavel");
  });

  it("flags both reasons independently for the same task", () => {
    const alerts = findAtRiskTasks(
      [task({ dueDate: new Date("2026-07-01"), responsible: "" })],
      now
    );
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.reason).sort()).toEqual(["atrasada", "sem_responsavel"]);
  });

  it("does not flag a task with a future due date and a responsible", () => {
    const alerts = findAtRiskTasks(
      [task({ dueDate: new Date("2026-12-01"), responsible: "Ana" })],
      now
    );
    expect(alerts).toHaveLength(0);
  });

  it("never flags a done task, even overdue and without a responsible", () => {
    const alerts = findAtRiskTasks(
      [task({ status: "done", dueDate: new Date("2026-07-01"), responsible: "" })],
      now
    );
    expect(alerts).toHaveLength(0);
  });

  it("treats whitespace-only responsible as missing", () => {
    const alerts = findAtRiskTasks([task({ responsible: "   " })], now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].reason).toBe("sem_responsavel");
  });
});
