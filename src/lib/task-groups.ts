import type { LocalDate, Task } from "@/lib/planner";

export type ActiveTaskScope =
  | "log:needs-estimate"
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

export function scopeForTask(task: Task, today: LocalDate): ActiveTaskScope | null {
  if (task.completedAt !== null) {
    return null;
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

export function formatMinutes(minutes: number | null) {
  return minutes === null ? "—" : `${minutes} min`;
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
