import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import {
  Calendar01Icon,
  Cancel01Icon,
  Clock01Icon,
  Delete02Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTaskMotion } from "@/components/task-motion";
import { useDeleteTask, usePlannerState, useUpdateTask } from "@/lib/planner-query";
import type { LocalDate, Task } from "@/lib/planner";
import { useTaskSelection, type TaskSelectionTransition } from "@/components/task-selection";
import type { WindowMode } from "@/lib/window-mode";

type EditingField = "estimate" | "title" | null;

const panelEnterEase = [0.23, 1, 0.32, 1] as const;

const panelVariants = {
  hidden: {
    opacity: 0,
    transform: "translateY(10px)",
  },
  visible: {
    opacity: 1,
    transform: "translateY(0)",
    transition: {
      duration: 0.22,
      ease: panelEnterEase,
    },
  },
  exit: (transition: TaskSelectionTransition) =>
    transition === "instant"
      ? {
          opacity: 0,
          transition: { duration: 0 },
        }
      : {
          opacity: 0,
          transform: "translateY(6px)",
          transition: {
            duration: 0.16,
            ease: panelEnterEase,
          },
        },
};

function dateFromLocalDate(value: LocalDate) {
  return new Date(`${value}T00:00:00`);
}

function localDateFromDate(value: Date): LocalDate {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}` as LocalDate;
}

function formatDueDate(value: LocalDate | null) {
  if (!value) {
    return "Set date";
  }

  return dateFromLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

type TaskDetailPanelProps = {
  taskId: string;
  transition: TaskSelectionTransition;
  windowMode: WindowMode;
};

export function TaskDetailPanel({ taskId, transition, windowMode }: TaskDetailPanelProps) {
  const planner = usePlannerState();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { recordTaskMutation } = useTaskMotion();
  const { clearSelection } = useTaskSelection();
  const task = planner.data?.tasks.find((candidate) => candidate.id === taskId);
  const lastTaskRef = useRef<Task | null>(null);
  if (task) {
    lastTaskRef.current = task;
  }
  const selectedTask = task ?? lastTaskRef.current;
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState("");
  const [scheduledDate, setScheduledDate] = useState<LocalDate | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const keepTaskButtonRef = useRef<HTMLButtonElement>(null);
  const interactionTransitionRef = useRef<TaskSelectionTransition>(transition);

  useEffect(() => {
    if (!task) {
      return;
    }

    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setEditingField(null);
    setDeleteArmed(false);
  }, [task]);

  useEffect(() => {
    if (deleteArmed) {
      keepTaskButtonRef.current?.focus();
    }
  }, [deleteArmed]);

  const normalizedEstimate = useMemo(() => estimate.trim(), [estimate]);
  const isDirty =
    selectedTask !== null &&
    (title !== selectedTask.title ||
      normalizedEstimate !== (selectedTask.estimateMinutes?.toString() ?? "") ||
      scheduledDate !== selectedTask.scheduledDate);
  const isSaving = updateTask.isPending || deleteTask.isPending;
  const controlsDisabled = isSaving || deleteArmed;

  if (!selectedTask) {
    return null;
  }
  const activeTask = selectedTask;

  function parseEstimate() {
    if (!normalizedEstimate) {
      return null;
    }

    const value = Number(normalizedEstimate);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteArmed) return;

    const estimateMinutes = parseEstimate();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      toast.error("Task title cannot be empty.");
      setEditingField("title");
      return;
    }

    if (estimateMinutes === undefined) {
      toast.error("Enter a whole number of minutes, or leave the estimate blank.");
      setEditingField("estimate");
      return;
    }

    recordTaskMutation({
      kind: "move",
      taskId: activeTask.id,
      transition: interactionTransitionRef.current,
    });
    updateTask.mutate(
      { id: activeTask.id, title: trimmedTitle, estimateMinutes, scheduledDate },
      {
        onSuccess: () => {
          clearSelection(interactionTransitionRef.current);
          toast.success("Task updated.");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task."),
      },
    );
  }

  function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    if (!deleteArmed) {
      setEditingField(null);
      setDeleteArmed(true);
      return;
    }

    if (event.detail > 1) {
      keepTaskButtonRef.current?.focus();
      return;
    }

    recordTaskMutation({
      kind: "delete",
      taskId: activeTask.id,
      transition: interactionTransitionRef.current,
    });
    deleteTask.mutate(activeTask.id, {
      onSuccess: () => {
        clearSelection(interactionTransitionRef.current);
        toast.success("Task deleted.");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete task."),
    });
  }

  return (
    <motion.form
      aria-label={`Edit ${selectedTask.title}`}
      animate="visible"
      className="task-detail-panel absolute inset-x-4 bottom-full rounded-t-xl border-x border-t border-[var(--task-detail-border)] bg-[var(--task-detail)] text-[var(--task-detail-foreground)]"
      exit="exit"
      initial={transition === "animate" ? "hidden" : false}
      data-task-detail
      onKeyDownCapture={() => {
        interactionTransitionRef.current = "instant";
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && deleteArmed) {
          event.preventDefault();
          event.stopPropagation();
          setDeleteArmed(false);
        }
      }}
      onPointerDownCapture={() => {
        interactionTransitionRef.current = "animate";
      }}
      onSubmit={handleSave}
      variants={panelVariants}
    >
      <div className={`mx-auto flex min-h-12 w-full max-w-xl min-w-0 items-center gap-1 px-4 py-2 sm:px-6 ${windowMode === "full" ? "max-w-3xl px-8" : ""}`}>
        <div className="min-w-0 flex-1">
          {editingField === "title" ? (
            <Input
              aria-label="Task title"
              autoFocus
              className="h-8 border-[var(--task-detail-border)] bg-[var(--task-detail-field)] text-[var(--task-detail-foreground)] placeholder:text-[var(--task-detail-muted)] focus-visible:border-ring"
              disabled={controlsDisabled}
              onBlur={() => setEditingField(null)}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setEditingField(null);
                }
              }}
              value={title}
            />
          ) : (
            <button
              aria-label="Edit task title"
              className="flex h-8 w-full items-center truncate rounded-md px-2 text-left text-menu font-medium outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              disabled={controlsDisabled}
              onClick={() => setEditingField("title")}
              type="button"
            >
              {title || "Untitled task"}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {editingField === "estimate" ? (
            <Input
              aria-label="Estimate in minutes"
              autoFocus
              className="h-8 w-20 border-[var(--task-detail-border)] bg-[var(--task-detail-field)] text-[var(--task-detail-foreground)] placeholder:text-[var(--task-detail-muted)] focus-visible:border-ring"
              disabled={controlsDisabled}
              inputMode="numeric"
              min="1"
              onBlur={() => setEditingField(null)}
              onChange={(event) => setEstimate(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setEditingField(null);
                }
              }}
              placeholder="Minutes"
              type="number"
              value={estimate}
            />
          ) : (
            <button
              aria-label="Edit estimate"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-menu tabular-nums outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              disabled={controlsDisabled}
              onClick={() => setEditingField("estimate")}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" icon={Clock01Icon} size={15} strokeWidth={1.7} />
              <span>{estimate.trim() ? `${estimate.trim()}m` : "Set time"}</span>
            </button>
          )}

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  aria-label="Edit due date"
                  className="h-8 min-w-0 justify-start px-2 text-[var(--task-detail-foreground)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"
                  disabled={controlsDisabled}
                  title="Edit due date"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon data-icon="inline-start" icon={Calendar01Icon} strokeWidth={1.7} />
              <span className="truncate text-menu">{formatDueDate(scheduledDate)}</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0" data-task-calendar side="top" sideOffset={8}>
              <Calendar
                mode="single"
                onSelect={(date) => {
                  if (date) {
                    setScheduledDate(localDateFromDate(date));
                  }
                }}
                selected={scheduledDate ? dateFromLocalDate(scheduledDate) : undefined}
              />
            </PopoverContent>
          </Popover>

          <Button
            aria-label={deleteArmed ? (deleteTask.isPending ? "Deleting task" : "Confirm delete task") : "Delete task"}
            aria-pressed={deleteArmed}
            className={deleteArmed ? undefined : "text-[var(--task-detail-muted)] hover:bg-destructive/10 hover:text-destructive"}
            disabled={isSaving}
            onClick={handleDelete}
            size="icon-sm"
            title={deleteArmed ? (deleteTask.isPending ? "Deleting task" : "Confirm delete task") : "Delete task"}
            type="button"
            variant={deleteArmed ? "destructive" : "ghost"}
          >
            <HugeiconsIcon
              className={deleteTask.isPending ? "animate-spin motion-reduce:animate-none" : undefined}
              icon={deleteTask.isPending ? Loading03Icon : Delete02Icon}
              strokeWidth={1.7}
            />
          </Button>
          {deleteArmed ? (
            <Button
              aria-label="Keep task"
              className="text-[var(--task-detail-muted)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"
              disabled={isSaving}
              onClick={() => setDeleteArmed(false)}
              ref={keepTaskButtonRef}
              size="icon-sm"
              title="Keep task"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.7} />
            </Button>
          ) : (
            <Button
              aria-label="Save changes"
              className={isDirty ? undefined : "text-[var(--task-detail-muted)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-muted)]"}
              disabled={!isDirty || isSaving}
              size="icon-sm"
              title="Save changes"
              type="submit"
              variant={isDirty ? "default" : "ghost"}
            >
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={1.7} />
            </Button>
          )}
        </div>
      </div>
      <span aria-live="polite" className="sr-only">
        {deleteArmed ? "Delete confirmation. Choose Keep task or Confirm delete task." : ""}
      </span>
    </motion.form>
  );
}
