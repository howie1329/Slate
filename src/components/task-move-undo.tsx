import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTaskMotion } from "@/components/task-motion";
import type { Task, TaskMoveDestination } from "@/lib/planner";
import { useMoveTask, usePlannerState } from "@/lib/planner-query";
import { getTaskMoveErrorMessage } from "@/lib/task-move";

const moveUndoDurationMs = 8_000;
const feedbackDurationMs = 5_000;

export type WorkspaceFeedbackSection = "today" | "backlog" | "done";

type TaskMoveUndo = {
  destination: TaskMoveDestination;
  expectedRevision: number;
  taskId: string;
  taskTitle: string;
};

type TaskMoveFeedback = {
  isError: boolean;
  message: string;
  section: WorkspaceFeedbackSection;
  undo: TaskMoveUndo | null;
};

type TaskMoveUndoContextValue = {
  feedback: TaskMoveFeedback | null;
  isUndoPending: boolean;
  reportFeedback: (message: string, isError?: boolean, section?: WorkspaceFeedbackSection) => void;
  registerSuccessfulMove: (input: {
    destination: TaskMoveDestination;
    revision: number;
    task: Pick<Task, "id" | "title">;
  }) => void;
  undo: () => void;
};

const TaskMoveUndoContext = createContext<TaskMoveUndoContextValue | null>(null);

export function TaskMoveUndoProvider({ children }: { children: ReactNode }) {
  const planner = usePlannerState();
  const moveTask = useMoveTask();
  const { recordTaskMutation } = useTaskMotion();
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const [feedback, setFeedback] = useState<TaskMoveFeedback | null>(null);

  const showFeedback = useCallback((nextFeedback: TaskMoveFeedback, duration: number) => {
    if (feedbackTimerRef.current !== undefined) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(nextFeedback);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = undefined;
    }, duration);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== undefined) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const pendingUndo = feedback?.undo;
    if (!pendingUndo || !planner.data) {
      return;
    }

    const task = planner.data.tasks.find((candidate) => candidate.id === pendingUndo.taskId);
    if (!task || task.revision > pendingUndo.expectedRevision) {
      showFeedback(
        {
          isError: true,
          message: `${pendingUndo.taskTitle} changed and can no longer be undone.`,
          section: sectionForDestination(pendingUndo.destination),
          undo: null,
        },
        feedbackDurationMs,
      );
    }
  }, [feedback, planner.data, showFeedback]);

  const registerSuccessfulMove = useCallback(
    ({ destination, revision, task }: Parameters<TaskMoveUndoContextValue["registerSuccessfulMove"]>[0]) => {
      showFeedback(
        {
          isError: false,
          message: `${task.title} moved ${destination === "today" ? "to Today" : "to Backlog"}.`,
          section: sectionForDestination(destination),
          undo: {
            destination: destination === "today" ? "backlog" : "today",
            expectedRevision: revision,
            taskId: task.id,
            taskTitle: task.title,
          },
        },
        moveUndoDurationMs,
      );
    },
    [showFeedback],
  );

  const reportFeedback = useCallback(
    (message: string, isError = false, section: WorkspaceFeedbackSection = "today") => {
      showFeedback({ isError, message, section, undo: null }, feedbackDurationMs);
    },
    [showFeedback],
  );

  const undo = useCallback(() => {
    const pendingUndo = feedback?.undo;
    if (!pendingUndo || moveTask.isPending) {
      return;
    }

    recordTaskMutation({ kind: "move", taskId: pendingUndo.taskId, transition: "animate" });
    moveTask.mutate(
      {
        id: pendingUndo.taskId,
        destination: pendingUndo.destination,
        expectedRevision: pendingUndo.expectedRevision,
      },
      {
        onSuccess: () => {
          showFeedback(
            {
              isError: false,
              message: `${pendingUndo.taskTitle} move undone.`,
              section: sectionForDestination(pendingUndo.destination),
              undo: null,
            },
            feedbackDurationMs,
          );
        },
        onError: (error) => {
          showFeedback(
            {
              isError: true,
              message: getTaskMoveErrorMessage(error),
              section: sectionForDestination(pendingUndo.destination),
              undo: null,
            },
            feedbackDurationMs,
          );
        },
      },
    );
  }, [feedback, moveTask, recordTaskMutation, showFeedback]);

  const value = useMemo(
    () => ({ feedback, isUndoPending: moveTask.isPending, registerSuccessfulMove, reportFeedback, undo }),
    [feedback, moveTask.isPending, registerSuccessfulMove, reportFeedback, undo],
  );

  return <TaskMoveUndoContext.Provider value={value}>{children}</TaskMoveUndoContext.Provider>;
}

export function WorkspaceMoveFeedback({ section }: { section: WorkspaceFeedbackSection }) {
  const { feedback, isUndoPending, undo } = useTaskMoveUndo();

  if (!feedback || feedback.section !== section) {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      className={`flex min-h-8 items-center justify-between gap-3 border-b py-2 text-xs leading-4 ${feedback.isError ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground"}`}
      data-task-move-feedback
      role={feedback.isError ? "alert" : "status"}
    >
      <span className="min-w-0 truncate">{feedback.message}</span>
      {feedback.undo ? (
        <Button
          className="h-6 shrink-0 px-1.5 text-xs text-primary"
          disabled={isUndoPending}
          onClick={undo}
          type="button"
          variant="link"
        >
          {isUndoPending ? "Undoing…" : "Undo"}
        </Button>
      ) : null}
    </aside>
  );
}

function sectionForDestination(destination: TaskMoveDestination): WorkspaceFeedbackSection {
  return destination === "today" ? "today" : "backlog";
}

export function useTaskMoveUndo() {
  const context = useContext(TaskMoveUndoContext);

  if (!context) {
    throw new Error("useTaskMoveUndo must be used within TaskMoveUndoProvider.");
  }

  return context;
}
