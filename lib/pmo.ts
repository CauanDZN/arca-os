export type PmoAlertReason = "atrasada" | "sem_responsavel";

export type PmoAlert = {
  taskId: string;
  title: string;
  areaName: string;
  reason: PmoAlertReason;
};

type TrackedTask = {
  id: string;
  title: string;
  areaName: string;
  status: string;
  dueDate: Date | null;
  responsible: string;
};

/**
 * Agente PMO: flags open tasks (not "done") that are past their due date or
 * still have no owner, so they don't silently sit unattended on the board.
 */
export function findAtRiskTasks(tasks: TrackedTask[], now: Date = new Date()): PmoAlert[] {
  const alerts: PmoAlert[] = [];

  for (const task of tasks) {
    if (task.status === "done") continue;

    if (task.dueDate && task.dueDate.getTime() < now.getTime()) {
      alerts.push({ taskId: task.id, title: task.title, areaName: task.areaName, reason: "atrasada" });
    }
    if (task.responsible.trim() === "") {
      alerts.push({ taskId: task.id, title: task.title, areaName: task.areaName, reason: "sem_responsavel" });
    }
  }

  return alerts;
}
