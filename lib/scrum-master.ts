export type OverdueSprint = { sprintId: string; sprintName: string; endDate: Date; pct: number };
export type EmptySprint = { sprintId: string; sprintName: string };
export type StuckTask = { taskId: string; title: string; areaName: string; daysSinceUpdate: number };

export type ScrumIssues = {
  overdueSprints: OverdueSprint[];
  emptySprints: EmptySprint[];
  stuckTasks: StuckTask[];
};

type SprintInput = {
  id: string;
  name: string;
  endDate: Date;
};

type TaskInput = {
  id: string;
  title: string;
  areaName: string;
  status: string;
  sprintId: string | null;
  updatedAt: Date;
};

const STUCK_THRESHOLD_DAYS = 14;

/**
 * Agente Scrum Master: pure rule, no AI. Flags sprints that ran past their
 * end date without finishing, sprints nobody assigned a task to, and open
 * tasks that haven't moved in a while. `updatedAt` is a proxy for "last
 * touched" (Prisma bumps it on any field edit, not only status changes) —
 * good enough to catch neglect, not a precise status-change timestamp; use
 * TaskEvent if that precision is ever needed.
 */
export function findScrumIssues(
  sprints: SprintInput[],
  tasks: TaskInput[],
  now: Date = new Date()
): ScrumIssues {
  const overdueSprints: OverdueSprint[] = [];
  const emptySprints: EmptySprint[] = [];
  const stuckTasks: StuckTask[] = [];

  const tasksBySprintId = new Map<string, TaskInput[]>();
  for (const task of tasks) {
    if (!task.sprintId) continue;
    tasksBySprintId.set(task.sprintId, [...(tasksBySprintId.get(task.sprintId) ?? []), task]);
  }

  for (const sprint of sprints) {
    const sprintTasks = tasksBySprintId.get(sprint.id) ?? [];

    if (sprintTasks.length === 0) {
      emptySprints.push({ sprintId: sprint.id, sprintName: sprint.name });
      continue;
    }

    if (sprint.endDate.getTime() < now.getTime()) {
      const done = sprintTasks.filter((t) => t.status === "done").length;
      const pct = Math.round((done / sprintTasks.length) * 100);
      if (pct < 100) {
        overdueSprints.push({ sprintId: sprint.id, sprintName: sprint.name, endDate: sprint.endDate, pct });
      }
    }
  }

  for (const task of tasks) {
    if (task.status === "done") continue;
    const daysSinceUpdate = Math.floor((now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate >= STUCK_THRESHOLD_DAYS) {
      stuckTasks.push({ taskId: task.id, title: task.title, areaName: task.areaName, daysSinceUpdate });
    }
  }

  return { overdueSprints, emptySprints, stuckTasks };
}
