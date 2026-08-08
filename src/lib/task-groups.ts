import type { LocalDate, Task } from "@/lib/planner";

export type TaskDisplayScope =
  | "log:needs-estimate"
  | "log:completed"
  | "log:unscheduled"
  | "log:upcoming"
  | "log:overdue"
  | `today:${LocalDate}`;

export type CapacityState = {
  committedMinutes: number;
  remainingMinutes: number;
  overageMinutes: number;
  isOverCapacity: boolean;
  overflowTaskId: string | null;
};

const backlogScopes = [
  "log:needs-estimate",
  "log:overdue",
  "log:unscheduled",
  "log:upcoming",
] as const;

export function scopeForTask(task: Task, today: LocalDate): TaskDisplayScope {
  if (task.completedAt !== null) {
    return task.scheduledDate === today ? `today:${today}` : "log:completed";
  }

  if (task.estimateMinutes === null) {
    return "log:needs-estimate";
  }

  if (task.scheduledDate === today) {
    return `today:${today}`;
  }

  if (task.scheduledDate === null) {
    return "log:unscheduled";
  }

  return task.scheduledDate < today ? "log:overdue" : "log:upcoming";
}

export function orderCompletedTasks(tasks: Task[]) {
  return [...tasks].sort((first, second) => {
    const completedAtOrder = (second.completedAt ?? "").localeCompare(first.completedAt ?? "");
    if (completedAtOrder !== 0) {
      return completedAtOrder;
    }

    return second.createdAt.localeCompare(first.createdAt) || second.id.localeCompare(first.id);
  });
}

export function orderTasks(tasks: Task[], orderByScope: Record<string, string[]>, scope: string) {
  const positions = new Map(orderByScope[scope]?.map((taskId, index) => [taskId, index]));

  return [...tasks].sort((first, second) => {
    const firstPosition = positions.get(first.id) ?? Number.MAX_SAFE_INTEGER;
    const secondPosition = positions.get(second.id) ?? Number.MAX_SAFE_INTEGER;

    if (firstPosition !== secondPosition) {
      return firstPosition - secondPosition;
    }

    return first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id);
  });
}

export function orderBacklogTasks(tasks: Task[], orderByScope: Record<string, string[]>, today: LocalDate) {
  return backlogScopes.flatMap((scope) =>
    orderTasks(
      tasks.filter((task) => scopeForTask(task, today) === scope),
      orderByScope,
      scope,
    ),
  );
}

export function getBacklogTaskMetadata(task: Task, today: LocalDate) {
  const scope = scopeForTask(task, today);
  const dateLabel = task.scheduledDate ? formatTaskDate(task.scheduledDate, today) : null;

  if (scope === "log:needs-estimate") {
    return dateLabel ? `Needs estimate · ${dateLabel}` : "Needs estimate";
  }

  if (scope === "log:overdue") {
    return dateLabel ? `Overdue · ${dateLabel}` : "Overdue";
  }

  if (scope === "log:upcoming") {
    return dateLabel ? `Scheduled ${dateLabel}` : "Scheduled";
  }

  return scope === "log:unscheduled" ? "Unscheduled" : null;
}

export function formatMinutes(minutes: number | null) {
  return minutes === null ? "—" : `${minutes} min`;
}

function formatTaskDate(date: LocalDate, today: LocalDate) {
  if (date === today) {
    return "Today";
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}

export function calculateCapacityState(tasks: Task[], capacityMinutes: number): CapacityState {
  let committedMinutes = 0;
  let overflowTaskId: string | null = null;

  for (const task of tasks) {
    if (task.completedAt !== null || task.estimateMinutes === null || task.estimateMinutes <= 0) {
      continue;
    }

    committedMinutes += task.estimateMinutes;

    if (overflowTaskId === null && committedMinutes > capacityMinutes) {
      overflowTaskId = task.id;
    }
  }

  const overageMinutes = Math.max(committedMinutes - capacityMinutes, 0);

  return {
    committedMinutes,
    remainingMinutes: Math.max(capacityMinutes - committedMinutes, 0),
    overageMinutes,
    isOverCapacity: overageMinutes > 0,
    overflowTaskId,
  };
}
