import type {
  LocalDate,
  PlanningLaneId,
  SetTaskCompletedInput,
  SetTaskScheduledDateInput,
  TaskInput,
  UpdateTaskInput,
} from "./planner.ts";
import type { TaskFinderResult } from "./task-finder.ts";

export type TaskFinderFilters = {
  lane: PlanningLaneId | null;
  overdue: boolean;
  needsEstimate: boolean;
};

export type TaskFinderCreationDraft = {
  estimate: string;
  scheduledDate: LocalDate | null;
  addToToday: boolean;
};

export type TaskFinderOption =
  | { key: `task:${string}`; kind: "task"; result: TaskFinderResult }
  | { key: "create"; kind: "create"; title: string };

export type TaskFinderEmptyState = "instructions" | "no-match" | "filtered-no-match" | null;
export type TaskFinderActionId = "open" | "move-today" | "complete" | "return-capture" | "reopen";

export type TaskFinderAction = {
  id: TaskFinderActionId;
  label: string;
  description?: string;
};

export type TaskFinderActionEffect =
  | { type: "open"; taskId: string }
  | { type: "set-completed"; input: SetTaskCompletedInput }
  | { type: "set-scheduled-date"; input: SetTaskScheduledDateInput }
  | { type: "update-task"; input: UpdateTaskInput };

export type TaskFinderCreateResult =
  | { ok: true; input: TaskInput }
  | { ok: false; error: "empty-title" | "invalid-estimate" };

export function emptyTaskFinderFilters(): TaskFinderFilters {
  return { lane: null, overdue: false, needsEstimate: false };
}

export function emptyTaskFinderCreationDraft(): TaskFinderCreationDraft {
  return { estimate: "", scheduledDate: null, addToToday: false };
}

export function hasTaskFinderFilters(filters: TaskFinderFilters) {
  return filters.lane !== null || filters.overdue || filters.needsEstimate;
}

export function filterTaskFinderResults(
  results: TaskFinderResult[],
  filters: TaskFinderFilters,
) {
  return results.filter((result) => {
    if (filters.lane && result.lane !== filters.lane) return false;
    if (filters.overdue && !result.badges.includes("overdue")) return false;
    if (filters.needsEstimate && result.estimateMinutes !== null) return false;
    return true;
  });
}

export function taskFinderEmptyState(
  query: string,
  titleResultCount: number,
  visibleResultCount: number,
  filters: TaskFinderFilters,
): TaskFinderEmptyState {
  if (!query.trim()) {
    if (!hasTaskFinderFilters(filters)) return "instructions";
    return visibleResultCount > 0 ? null : "filtered-no-match";
  }
  if (visibleResultCount > 0) return null;
  return titleResultCount > 0 && hasTaskFinderFilters(filters) ? "filtered-no-match" : "no-match";
}

export function taskFinderOptions(
  results: TaskFinderResult[],
  query: string,
  includeFilteredResults = false,
): TaskFinderOption[] {
  const title = query.trim();
  if (!title) {
    if (!includeFilteredResults) return [];
    return results.map((result): TaskFinderOption => ({
      key: `task:${result.id}`,
      kind: "task",
      result,
    }));
  }

  return [
    ...results.map((result): TaskFinderOption => ({
      key: `task:${result.id}`,
      kind: "task",
      result,
    })),
    { key: "create", kind: "create", title },
  ];
}

export function moveTaskFinderIndex(
  currentIndex: number,
  direction: -1 | 1,
  optionCount: number,
) {
  if (optionCount === 0) return -1;
  return Math.min(Math.max(currentIndex + direction, 0), optionCount - 1);
}

export function taskFinderCreateInput(
  query: string,
  draft: TaskFinderCreationDraft = emptyTaskFinderCreationDraft(),
  today?: LocalDate,
): TaskFinderCreateResult {
  const title = query.trim();
  if (!title) return { ok: false, error: "empty-title" };

  const estimate = draft.estimate.trim();
  const estimateMinutes = estimate ? Number(estimate) : null;
  if (estimateMinutes !== null && (!Number.isInteger(estimateMinutes) || estimateMinutes <= 0)) {
    return { ok: false, error: "invalid-estimate" };
  }

  return {
    ok: true,
    input: {
      title,
      estimateMinutes,
      scheduledDate: draft.addToToday && today ? today : draft.scheduledDate,
      source: "manual",
    },
  };
}

export function taskFinderActions(result: TaskFinderResult): TaskFinderAction[] {
  if (result.lane === "done") {
    return [
      { id: "open", label: "Open" },
      { id: "reopen", label: "Reopen" },
    ];
  }

  const actions: TaskFinderAction[] = [{ id: "open", label: "Open" }];
  if (result.lane !== "today") actions.push({ id: "move-today", label: "Move to Today" });
  actions.push({ id: "complete", label: "Complete" });
  if (result.lane !== "capture") {
    actions.push({
      id: "return-capture",
      label: "Return to Capture",
      description: "Clears estimate and date",
    });
  }
  return actions;
}

export function taskFinderActionEffect(
  result: TaskFinderResult,
  action: TaskFinderActionId,
  today: LocalDate,
): TaskFinderActionEffect | null {
  if (action === "open") return { type: "open", taskId: result.id };
  if (action === "move-today" && result.lane !== "done" && result.lane !== "today") {
    return {
      type: "set-scheduled-date",
      input: { id: result.id, scheduledDate: today, expectedRevision: result.revision },
    };
  }
  if (action === "complete" && result.lane !== "done") {
    return {
      type: "set-completed",
      input: { id: result.id, completed: true, expectedRevision: result.revision },
    };
  }
  if (action === "reopen" && result.lane === "done") {
    return {
      type: "set-completed",
      input: { id: result.id, completed: false, expectedRevision: result.revision },
    };
  }
  if (action === "return-capture" && result.lane !== "capture" && result.lane !== "done") {
    return {
      type: "update-task",
      input: {
        id: result.id,
        title: result.title,
        estimateMinutes: null,
        scheduledDate: null,
        anchorDate: result.anchorDate,
        expectedRevision: result.revision,
      },
    };
  }
  return null;
}
