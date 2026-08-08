import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type TaskSelectionTransition = "animate" | "instant";
export type TaskSelectionFocus = "estimate" | null;

type TaskSelectionContextValue = {
  clearSelection: (transition?: TaskSelectionTransition) => void;
  clearSelectedTaskFocus: () => void;
  selectedTaskId: string | null;
  selectedTaskFocus: TaskSelectionFocus;
  selectedTaskTransition: TaskSelectionTransition;
  selectTask: (taskId: string, transition?: TaskSelectionTransition, focus?: TaskSelectionFocus) => void;
};

const TaskSelectionContext = createContext<TaskSelectionContextValue | null>(null);

export function TaskSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskFocus, setSelectedTaskFocus] = useState<TaskSelectionFocus>(null);
  const [selectedTaskTransition, setSelectedTaskTransition] = useState<TaskSelectionTransition>("instant");
  const clearSelection = useCallback((transition: TaskSelectionTransition = "animate") => {
    setSelectedTaskTransition(transition);
    setSelectedTaskFocus(null);
    setSelectedTaskId(null);
  }, []);
  const clearSelectedTaskFocus = useCallback(() => {
    setSelectedTaskFocus(null);
  }, []);
  const selectTask = useCallback((taskId: string, transition: TaskSelectionTransition = "animate", focus: TaskSelectionFocus = null) => {
    setSelectedTaskTransition(transition);
    setSelectedTaskFocus(focus);
    setSelectedTaskId(taskId);
  }, []);
  const value = useMemo(
    () => ({ clearSelection, clearSelectedTaskFocus, selectedTaskFocus, selectedTaskId, selectedTaskTransition, selectTask }),
    [clearSelectedTaskFocus, clearSelection, selectedTaskFocus, selectedTaskId, selectedTaskTransition, selectTask],
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
