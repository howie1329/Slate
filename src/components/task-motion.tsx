import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type TaskMotionTransition = "animate" | "instant";
export type TaskMutationKind = "complete" | "create" | "delete" | "move" | "restore";

export type TaskMutationMotion = {
  kind: TaskMutationKind;
  taskId?: string;
  transition: TaskMotionTransition;
  version: number;
};

type TaskMotionContextValue = {
  recordTaskMutation: (mutation: Omit<TaskMutationMotion, "version">) => void;
  taskMutation: TaskMutationMotion | null;
};

const TaskMotionContext = createContext<TaskMotionContextValue | null>(null);

export function TaskMotionProvider({ children }: { children: ReactNode }) {
  const [taskMutation, setTaskMutation] = useState<TaskMutationMotion | null>(null);
  const recordTaskMutation = useCallback((mutation: Omit<TaskMutationMotion, "version">) => {
    setTaskMutation((current) => ({ ...mutation, version: (current?.version ?? 0) + 1 }));
  }, []);
  const value = useMemo(
    () => ({ recordTaskMutation, taskMutation }),
    [recordTaskMutation, taskMutation],
  );

  return <TaskMotionContext.Provider value={value}>{children}</TaskMotionContext.Provider>;
}

export function useTaskMotion() {
  const context = useContext(TaskMotionContext);

  if (!context) {
    throw new Error("useTaskMotion must be used within TaskMotionProvider.");
  }

  return context;
}
