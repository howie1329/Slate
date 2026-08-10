import type { PlannerSnapshot, PlanningLaneId } from "./planner";

export type OrderedPlanningLane = Exclude<PlanningLaneId, "done">;

export function reorderPlanningLane(
  snapshot: PlannerSnapshot,
  lane: OrderedPlanningLane,
  taskIds: string[],
) {
  const section = snapshot.planning.lanes[lane];
  const tasksById = new Map(section.tasks.map((task) => [task.id, task]));
  const tasks = taskIds.flatMap((taskId) => {
    const task = tasksById.get(taskId);
    return task ? [task] : [];
  });

  return {
    ...snapshot,
    planning: {
      ...snapshot.planning,
      lanes: {
        ...snapshot.planning.lanes,
        [lane]: {
          ...section,
          tasks,
        },
      },
    },
  };
}
