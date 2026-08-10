import { PLANNING_LANES, type PlannerSnapshot, type PlanningLaneId, type PlanningSection, type PlanningTask } from "./planner.ts";

export { PLANNING_LANES };
export type { PlanningLaneId };
export type PlanningBoardFilter = "all" | "attention" | "scheduled" | "unscheduled";
export type PlanningBoardSort = "planning" | "title" | "estimate" | "newest";

export type PlanningBoardLane = {
  id: PlanningLaneId;
  label: string;
  reorder: PlanningSection["reorder"];
  tasks: PlanningTask[];
};

export function planningBoardLanes(
  snapshot: PlannerSnapshot,
  query: string,
  filter: PlanningBoardFilter,
  sort: PlanningBoardSort,
): PlanningBoardLane[] {
  const lanes = snapshot.planning.lanes;
  const source: PlanningBoardLane[] = [
    { id: "capture", label: "Capture", reorder: lanes.capture.reorder, tasks: lanes.capture.tasks },
    { id: "ready", label: "Ready", reorder: lanes.ready.reorder, tasks: lanes.ready.tasks },
    { id: "today", label: "Today", reorder: lanes.today.reorder, tasks: lanes.today.tasks },
    { id: "done", label: "Done", reorder: lanes.done.reorder, tasks: lanes.done.tasks },
  ];

  const normalizedQuery = query.trim().toLocaleLowerCase();
  return source.map((lane) => ({
    ...lane,
    tasks: sortTasks(
      lane.tasks.filter((task) => {
        if (normalizedQuery && !task.title.toLocaleLowerCase().includes(normalizedQuery)) return false;
        if (filter === "attention" && lane.id === "done") return false;
        if (filter === "attention") {
          return task.estimateMinutes === null || task.badges.includes("overdue");
        }
        if (filter === "scheduled") return task.scheduledDate !== null;
        if (filter === "unscheduled") return task.scheduledDate === null && task.completedAt === null;
        return true;
      }),
      sort,
      lane.id,
    ),
  }));
}

function sortTasks(tasks: PlanningTask[], sort: PlanningBoardSort, lane: PlanningLaneId) {
  if (sort === "planning" && lane !== "done") return tasks;

  return [...tasks].sort((left, right) => {
    if (sort === "title") return left.title.localeCompare(right.title);
    if (sort === "estimate") {
      return (left.estimateMinutes ?? Number.MAX_SAFE_INTEGER) - (right.estimateMinutes ?? Number.MAX_SAFE_INTEGER);
    }

    const leftDate = lane === "done" ? left.completedAt : left.createdAt;
    const rightDate = lane === "done" ? right.completedAt : right.createdAt;
    return (rightDate ?? "").localeCompare(leftDate ?? "");
  });
}
