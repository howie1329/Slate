import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type TaskSelectionTransition = "animate" | "instant";

type TaskSelectionContextValue = {
  clearSelection: (transition?: TaskSelectionTransition) => void;
  selectedTaskId: string | null;
  selectedTaskTransition: TaskSelectionTransition;
  selectTask: (taskId: string, transition?: TaskSelectionTransition) => void;
};

const TaskSelectionContext = createContext<TaskSelectionContextValue | null>(null);

export function TaskSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskTransition, setSelectedTaskTransition] = useState<TaskSelectionTransition>("instant");
  const clearSelection = useCallback((transition: TaskSelectionTransition = "animate") => {
    setSelectedTaskTransition(transition);
    setSelectedTaskId(null);
  }, []);
  const selectTask = useCallback((taskId: string, transition: TaskSelectionTransition = "animate") => {
    setSelectedTaskTransition(transition);
    setSelectedTaskId(taskId);
  }, []);
  const value = useMemo(
    () => ({ clearSelection, selectedTaskId, selectedTaskTransition, selectTask }),
    [clearSelection, selectedTaskId, selectedTaskTransition, selectTask],
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
