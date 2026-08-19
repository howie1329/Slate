import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PlanningLaneId } from "@/lib/planner";

export type TaskSelectionTransition = "animate" | "instant";

type TaskSelectionContextValue = {
  clearSelection: (transition?: TaskSelectionTransition) => void;
  selectedTaskDraftLane: PlanningLaneId | null;
  selectedTaskId: string | null;
  selectedTaskTransition: TaskSelectionTransition;
  selectTask: (
    taskId: string,
    transition?: TaskSelectionTransition,
    draftLane?: PlanningLaneId,
  ) => void;
};

const TaskSelectionContext = createContext<TaskSelectionContextValue | null>(null);

export function TaskSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskDraftLane, setSelectedTaskDraftLane] = useState<PlanningLaneId | null>(null);
  const [selectedTaskTransition, setSelectedTaskTransition] = useState<TaskSelectionTransition>("instant");
  const clearSelection = useCallback((transition: TaskSelectionTransition = "animate") => {
    setSelectedTaskTransition(transition);
    setSelectedTaskId(null);
    setSelectedTaskDraftLane(null);
  }, []);
  const selectTask = useCallback((
    taskId: string,
    transition: TaskSelectionTransition = "animate",
    draftLane?: PlanningLaneId,
  ) => {
    setSelectedTaskTransition(transition);
    setSelectedTaskId(taskId);
    setSelectedTaskDraftLane(draftLane ?? null);
  }, []);
  const value = useMemo(
    () => ({ clearSelection, selectedTaskDraftLane, selectedTaskId, selectedTaskTransition, selectTask }),
    [clearSelection, selectedTaskDraftLane, selectedTaskId, selectedTaskTransition, selectTask],
  );

  return (
    <TaskSelectionContext.Provider value={value}>{children}</TaskSelectionContext.Provider>
  );
}

export function useTaskSelection() {
  const context = useContext(TaskSelectionContext);

  if (!context) {
    throw new Error("useTaskSelection must be used within TaskSelectionProvider.");
  }

  return context;
}
