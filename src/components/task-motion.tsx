import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type TaskMotionTransition = "animate" | "instant";
export type TaskMutationKind = "complete" | "create" | "delete" | "move" | "restore";

export type TaskMutationMotion = {
  kind: TaskMutationKind;
  taskId?: string;
  transition: TaskMotionTransition;
  version: number;
};

type TaskMotionContextValue = {
  clearTaskMutation: (version: number) => void;
  recordTaskMutation: (mutation: Omit<TaskMutationMotion, "version">) => void;
  taskMutation: TaskMutationMotion | null;
};

const TaskMotionContext = createContext<TaskMotionContextValue | null>(null);
const taskMotionFallbackDurationMs = 240;

export function TaskMotionProvider({ children }: { children: ReactNode }) {
  const [taskMutation, setTaskMutation] = useState<TaskMutationMotion | null>(null);
  const motionVersionRef = useRef(0);
  const settleTimerRef = useRef<number | undefined>(undefined);
  const clearTaskMutation = useCallback((version: number) => {
    setTaskMutation((current) => {
      if (current?.version !== version) {
        return current;
      }
      if (settleTimerRef.current !== undefined) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = undefined;
      }
      return null;
    });
  }, []);
  const recordTaskMutation = useCallback((mutation: Omit<TaskMutationMotion, "version">) => {
    if (settleTimerRef.current !== undefined) {
      window.clearTimeout(settleTimerRef.current);
    }
    motionVersionRef.current += 1;
    const version = motionVersionRef.current;
    setTaskMutation({ ...mutation, version });
    settleTimerRef.current = window.setTimeout(
      () => clearTaskMutation(version),
      mutation.transition === "animate" ? taskMotionFallbackDurationMs : 0,
    );
  }, [clearTaskMutation]);

  useEffect(
    () => () => {
      if (settleTimerRef.current !== undefined) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    [],
  );
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
