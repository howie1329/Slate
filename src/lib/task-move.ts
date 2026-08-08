import type { MoveTaskInput, Task, TaskMoveDestination } from "@/lib/planner";
import { calculateCapacityState, type CapacityState } from "@/lib/task-groups";

export type TaskMovePreview = {
  destination: TaskMoveDestination;
  deltaMinutes: number;
  resultingCapacity: CapacityState;
  requiresEstimate: boolean;
};

export function getTaskMovePreview(
  task: Task,
  destination: TaskMoveDestination,
  todayTasks: Task[],
  capacityMinutes: number,
): TaskMovePreview {
  const estimateMinutes = task.estimateMinutes ?? 0;
  const requiresEstimate = destination === "today" && estimateMinutes <= 0;
  const taskIsInToday = todayTasks.some((candidate) => candidate.id === task.id);
  const projectedTodayTasks =
    destination === "today"
      ? taskIsInToday || requiresEstimate
        ? todayTasks
        : [...todayTasks, task]
      : todayTasks.filter((candidate) => candidate.id !== task.id);

  return {
    destination,
    deltaMinutes: destination === "today" ? estimateMinutes : -estimateMinutes,
    resultingCapacity: calculateCapacityState(projectedTodayTasks, capacityMinutes),
    requiresEstimate,
  };
}

export function buildTaskMoveInput(task: Task, destination: TaskMoveDestination): MoveTaskInput {
  return {
    id: task.id,
    destination,
    expectedRevision: task.revision,
  };
}

export function isEstimateRequiredMoveError(error: unknown) {
  return error instanceof Error && error.message.includes("estimate-required");
}

export function getTaskMoveErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("stale-task")) {
      return "This task changed in another window. It was not moved.";
    }
    if (error.message.includes("Task is not committed to Today.")) {
      return "This task is no longer committed to Today. It was not moved.";
    }
    if (error.message.includes("Completed tasks cannot be moved.")) {
      return "Completed tasks cannot be moved.";
    }
  }

  return "Could not move task. Your task was not changed.";
}
