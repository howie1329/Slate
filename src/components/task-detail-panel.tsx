import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  Clock01Icon,
  Delete02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDeleteTask, usePlannerState, useUpdateTask } from "@/lib/planner-query";
import type { LocalDate } from "@/lib/planner";
import { useTaskSelection } from "@/components/task-selection";
import type { WindowMode } from "@/lib/window-mode";

type EditingField = "estimate" | "title" | null;

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
    return "Set due date";
  }

  return dateFromLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function TaskDetailPanel({ windowMode }: { windowMode: WindowMode }) {
  const planner = usePlannerState();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { clearSelection, selectedTaskId } = useTaskSelection();
  const task = planner.data?.tasks.find((candidate) => candidate.id === selectedTaskId);
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState("");
  const [scheduledDate, setScheduledDate] = useState<LocalDate | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);

  useEffect(() => {
    if (!task) {
      return;
    }

    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setEditingField(null);
  }, [task]);

  const normalizedEstimate = useMemo(() => estimate.trim(), [estimate]);
  const isDirty =
    task !== undefined &&
    (title !== task.title ||
      normalizedEstimate !== (task.estimateMinutes?.toString() ?? "") ||
      scheduledDate !== task.scheduledDate);
  const isSaving = updateTask.isPending || deleteTask.isPending;

  if (!task) {
    return null;
  }

  const selectedTask = task;

  function parseEstimate() {
    if (!normalizedEstimate) {
      return null;
    }

    const value = Number(normalizedEstimate);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    updateTask.mutate(
      { id: selectedTask.id, title: trimmedTitle, estimateMinutes, scheduledDate },
      {
        onSuccess: () => {
          clearSelection();
          toast.success("Task updated.");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task."),
      },
    );
  }

  function handleDelete() {
    deleteTask.mutate(selectedTask.id, {
      onSuccess: () => {
        clearSelection();
        toast.success("Task deleted.");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete task."),
    });
  }

  return (
    <form
      aria-label={`Edit ${selectedTask.title}`}
      className="task-detail-panel absolute inset-x-4 bottom-full rounded-t-xl border-x border-t border-[var(--task-detail-border)] bg-[var(--task-detail)] text-[var(--task-detail-foreground)] duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-reduce:animate-none"
      data-task-detail
      onSubmit={handleSave}
    >
      <div className={`mx-auto flex w-full max-w-xl flex-col gap-2 px-4 py-2 sm:px-6 ${windowMode === "full" ? "max-w-3xl px-8" : ""}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="min-w-0 flex-1">
            {editingField === "title" ? (
              <Input
                aria-label="Task title"
                autoFocus
                className="h-8 border-[var(--task-detail-border)] bg-[var(--task-detail-field)] text-[var(--task-detail-foreground)] placeholder:text-[var(--task-detail-muted)] focus-visible:border-ring"
                disabled={isSaving}
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
                disabled={isSaving}
                onClick={() => setEditingField("title")}
                type="button"
              >
                {title || "Untitled task"}
              </button>
            )}
          </div>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  aria-label="Delete task"
                  className="text-[var(--task-detail-muted)] hover:bg-destructive/10 hover:text-destructive"
                  disabled={isSaving}
                  size="icon-sm"
                  title="Delete task"
                  type="button"
                  variant="ghost"
                />
              }
            >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.7} />
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Delete task?</DialogTitle>
                <DialogDescription>
                  “{selectedTask.title}” will be removed from this Mac and cannot be restored.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button disabled={isSaving} type="button" variant="outline" />}>
                  Keep task
                </DialogClose>
                <Button disabled={isSaving} onClick={handleDelete} type="button" variant="destructive">
                  Delete task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        </div>

        <div className="flex min-w-0 items-center gap-1">
          {editingField === "estimate" ? (
            <Input
              aria-label="Estimate in minutes"
              autoFocus
              className="h-8 w-28 border-[var(--task-detail-border)] bg-[var(--task-detail-field)] text-[var(--task-detail-foreground)] placeholder:text-[var(--task-detail-muted)] focus-visible:border-ring"
              disabled={isSaving}
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
              placeholder="Set estimate"
              type="number"
              value={estimate}
            />
          ) : (
            <button
              aria-label="Edit estimate"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-menu tabular-nums outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              disabled={isSaving}
              onClick={() => setEditingField("estimate")}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" icon={Clock01Icon} size={15} strokeWidth={1.7} />
              <span>{estimate.trim() ? `${estimate.trim()} min` : "Set estimate"}</span>
            </button>
          )}

          <span aria-hidden="true" className="text-menu text-[var(--task-detail-muted)]">
            ·
          </span>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  aria-label="Edit due date"
                  className="h-8 min-w-0 justify-start px-2 text-[var(--task-detail-foreground)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"
                  disabled={isSaving}
                  title="Edit due date"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon data-icon="inline-start" icon={Calendar01Icon} strokeWidth={1.7} />
              <span className="truncate text-menu">{formatDueDate(scheduledDate)}</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0" side="top" sideOffset={8}>
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
        </div>
      </div>
    </form>
  );
}
