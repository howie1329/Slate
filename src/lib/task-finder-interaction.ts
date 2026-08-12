import type { TaskInput } from "./planner.ts";
import type { TaskFinderResult } from "./task-finder.ts";

export type TaskFinderOption =
  | { key: `task:${string}`; kind: "task"; result: TaskFinderResult }
  | { key: "create"; kind: "create"; title: string };

export function taskFinderOptions(results: TaskFinderResult[], query: string): TaskFinderOption[] {
  const title = query.trim();
  if (!title) return [];

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

export function taskFinderCreateInput(query: string): TaskInput | null {
  const title = query.trim();
  if (!title) return null;

  return {
    title,
    estimateMinutes: null,
    scheduledDate: null,
    source: "manual",
  };
}
