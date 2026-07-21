import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type TaskSelectionContextValue = {
  clearSelection: () => void;
  selectedTaskId: string | null;
  selectTask: (taskId: string) => void;
};

const TaskSelectionContext = createContext<TaskSelectionContextValue | null>(null);

export function TaskSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const clearSelection = useCallback(() => setSelectedTaskId(null), []);
  const selectTask = useCallback((taskId: string) => setSelectedTaskId(taskId), []);
  const value = useMemo(
    () => ({ clearSelection, selectedTaskId, selectTask }),
    [clearSelection, selectedTaskId, selectTask],
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
