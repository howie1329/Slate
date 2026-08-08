import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type TaskMotionTransition = "animate" | "instant";
export type TaskMotionKind = "complete" | "create" | "delete" | "move" | "restore" | "update";

export type TaskMutationMotion = {
  kind: TaskMotionKind;
  taskId?: string;
  transition: TaskMotionTransition;
  version: number;
};

type TaskMotionContextValue = {
  clearTaskMutation: (version: number) => void;
  recordTaskMutation: (mutation: Omit<TaskMutationMotion, "version">) => number;
  taskMutation: TaskMutationMotion | null;
};

const TaskMotionContext = createContext<TaskMotionContextValue | null>(null);

export function TaskMotionProvider({ children }: { children: ReactNode }) {
  const [taskMutation, setTaskMutation] = useState<TaskMutationMotion | null>(null);
  const motionVersionRef = useRef(0);
  const clearTaskMutation = useCallback((version: number) => {
    setTaskMutation((current) => (current?.version === version ? null : current));
  }, []);
  const recordTaskMutation = useCallback((mutation: Omit<TaskMutationMotion, "version">) => {
    motionVersionRef.current += 1;
    const version = motionVersionRef.current;
    setTaskMutation({ ...mutation, version });
    return version;
  }, []);
  const value = useMemo(
    () => ({ clearTaskMutation, recordTaskMutation, taskMutation }),
    [clearTaskMutation, recordTaskMutation, taskMutation],
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
