import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Calendar01Icon,
  Cancel01Icon,
  Clock01Icon,
  Delete02Icon,
  BookmarkCheck01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTaskMotion } from "@/components/task-motion";
import {
  useDeleteTask,
  usePlannerState,
  useSetTaskScheduledDate,
  useUpdateTask,
} from "@/lib/planner-query";
import { planningTasks, type LocalDate, type Task } from "@/lib/planner";
import { dateFromLocalDate, formatDueDate, localDateFromDate } from "@/lib/local-date";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import { useTaskSelection, type TaskSelectionTransition } from "@/components/task-selection";
import type { WindowMode } from "@/lib/window-mode";

type EditingField = "estimate" | "title" | null;
type ValidationError = Exclude<EditingField, null>;

const panelEnterEase = [0.23, 1, 0.32, 1] as const;

const panelContentVariants = {
  hidden: {
    opacity: 0,
    transform: "translateY(3px)",
  },
  visible: {
    opacity: 1,
    transform: "translateY(0)",
    transition: {
      duration: 0.16,
      delay: 0.03,
      ease: panelEnterEase,
    },
  },
};

const panelVariants = {
  hidden: {
    opacity: 0,
    transform: "translateY(8px)",
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

type TaskDetailPanelProps = {
  taskId: string;
  transition: TaskSelectionTransition;
  windowMode: WindowMode;
};

export function TaskDetailPanel({ taskId, transition, windowMode }: TaskDetailPanelProps) {
  const planner = usePlannerState();
  const updateTask = useUpdateTask();
  const setTaskScheduledDate = useSetTaskScheduledDate();
  const deleteTask = useDeleteTask();
  const { clearTaskMutation, recordTaskMutation } = useTaskMotion();
  const { clearSelection } = useTaskSelection();
  const task = planner.data
    ? planningTasks(planner.data).find((candidate) => candidate.id === taskId)
    : undefined;
  const lastTaskRef = useRef<Task | null>(null);
  if (task) {
    lastTaskRef.current = task;
  }
  const selectedTask = task ?? lastTaskRef.current;
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState("");
  const [scheduledDate, setScheduledDate] = useState<LocalDate | null>(null);
  const [anchorDate, setAnchorDate] = useState<LocalDate | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const draftRevisionRef = useRef<number | null>(null);
  const keepTaskButtonRef = useRef<HTMLButtonElement>(null);
  const interactionTransitionRef = useRef<TaskSelectionTransition>(transition);

  useEffect(() => {
    if (!task) {
      return;
    }

    const draftIsFromAnotherRevision =
      draftRevisionRef.current !== null && draftRevisionRef.current !== task.revision;
    if (draftIsFromAnotherRevision && isDirty) {
      setIsStale(true);
      return;
    }

    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setAnchorDate(task.anchorDate);
    draftRevisionRef.current = task.revision;
    setIsStale(false);
    setEditingField(null);
    setValidationError(null);
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
      scheduledDate !== selectedTask.scheduledDate ||
      anchorDate !== selectedTask.anchorDate);
  const isSaving = updateTask.isPending || setTaskScheduledDate.isPending || deleteTask.isPending;
  const controlsDisabled = isSaving || deleteArmed || isStale;

  if (!selectedTask) {
    return null;
  }
  const activeTask = selectedTask;
  const movementAction = planner.data
    ? activeTask.scheduledDate === planner.data.today
      ? "backlog"
      : "today"
    : null;

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
    if (isStale || draftRevisionRef.current === null) return;

    const estimateMinutes = parseEstimate();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setValidationError("title");
      toast.error("Task title cannot be empty.");
      setEditingField("title");
      return;
    }

    if (estimateMinutes === undefined) {
      setValidationError("estimate");
      toast.error("Enter a whole number of minutes, or leave the estimate blank.");
      setEditingField("estimate");
      return;
    }

    setValidationError(null);

    const mutationVersion = recordTaskMutation({
      kind: "update",
      taskId: activeTask.id,
      transition: interactionTransitionRef.current,
    });
    updateTask.mutate(
      {
        id: activeTask.id,
        title: trimmedTitle,
        estimateMinutes,
        scheduledDate,
        anchorDate,
        expectedRevision: draftRevisionRef.current,
      },
      {
        onSuccess: () => {
          clearTaskMutation(mutationVersion);
          clearSelection(interactionTransitionRef.current);
          toast.success("Task updated.");
        },
        onError: (error) => {
          clearTaskMutation(mutationVersion);
          toast.error(plannerMutationErrorMessage(error, "Could not update task."));
        },
      },
    );
  }

  function reviewLatest() {
    if (!task) return;
    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setAnchorDate(task.anchorDate);
    draftRevisionRef.current = task.revision;
    setIsStale(false);
    setValidationError(null);
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

    const mutationVersion = recordTaskMutation({
      kind: "delete",
      taskId: activeTask.id,
      transition: interactionTransitionRef.current,
    });
    if (draftRevisionRef.current === null) return;
    deleteTask.mutate({ id: activeTask.id, expectedRevision: draftRevisionRef.current }, {
      onSuccess: () => {
        clearSelection(interactionTransitionRef.current);
        toast.success("Task deleted.");
      },
      onError: (error) => {
        clearTaskMutation(mutationVersion);
        toast.error(plannerMutationErrorMessage(error, "Could not delete task."));
      },
    });
  }

  function handleMovement() {
    const today = planner.data?.today;
    const expectedRevision = draftRevisionRef.current;
    if (!today || expectedRevision === null || movementAction === null || controlsDisabled || isDirty) {
      return;
    }

    const returningToBacklog = movementAction === "backlog";
    const mutationVersion = recordTaskMutation({
      kind: "move",
      taskId: activeTask.id,
      transition: interactionTransitionRef.current,
    });
    setTaskScheduledDate.mutate(
      {
        id: activeTask.id,
        scheduledDate: returningToBacklog ? null : today,
        expectedRevision,
      },
      {
        onSuccess: () => {
          clearSelection(interactionTransitionRef.current);
          toast.success(returningToBacklog ? "Task returned to Backlog." : "Task committed to Today.");
        },
        onError: (error) => {
          clearTaskMutation(mutationVersion);
          toast.error(plannerMutationErrorMessage(error, "Could not move task."));
        },
      },
    );
  }

  return (
    <motion.form
      aria-label={`Edit ${selectedTask.title}`}
      animate="visible"
      className={
        windowMode === "full"
          ? "task-detail-panel relative h-full w-full overflow-y-auto bg-[var(--task-detail)] text-[var(--task-detail-foreground)]"
          : "task-detail-panel absolute inset-x-4 bottom-full rounded-t-xl border-x border-t border-[var(--task-detail-border)] bg-[var(--task-detail)] text-[var(--task-detail-foreground)]"
      }
      exit="exit"
      id="task-detail-panel"
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
      {isStale ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--task-detail-border)] px-4 py-2 text-xs sm:px-6">
          <span className="text-[var(--task-detail-muted)]">This task changed in another window.</span>
          <Button className="h-7 shrink-0 px-2 text-xs" onClick={reviewLatest} type="button" variant="outline">
            Review latest
          </Button>
        </div>
      ) : null}
      {windowMode === "popover" ? (
        <motion.div
          animate="visible"
          className="mx-auto w-full max-w-xl min-w-0"
          initial={transition === "animate" ? "hidden" : false}
          variants={panelContentVariants}
        >
          <div className="flex min-h-12 items-center gap-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              {editingField === "title" ? (
                <Input
                  aria-describedby={validationError === "title" ? "task-detail-validation" : undefined}
                  aria-invalid={validationError === "title"}
                  aria-label="Task title"
                  autoFocus
                  className="h-8 border-transparent bg-transparent px-2 text-menu font-semibold text-[var(--task-detail-foreground)] capitalize shadow-none placeholder:normal-case placeholder:text-[var(--task-detail-muted)] focus-visible:bg-[var(--task-detail-field)]"
                  disabled={controlsDisabled}
                  onBlur={() => setEditingField(null)}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (validationError === "title") setValidationError(null);
                  }}
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
                  aria-describedby={validationError === "title" ? "task-detail-validation" : undefined}
                  aria-invalid={validationError === "title"}
                  aria-label="Edit task title"
                  className="flex h-8 w-full min-w-0 items-center truncate rounded-md px-2 text-left text-menu font-semibold capitalize outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
                  disabled={controlsDisabled}
                  onClick={() => setEditingField("title")}
                  type="button"
                >
                  <span className="truncate">{title || "Untitled task"}</span>
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                aria-label={updateTask.isPending ? "Saving changes" : "Save changes"}
                className={isDirty ? undefined : "text-[var(--task-detail-muted)] hover:bg-transparent hover:text-[var(--task-detail-muted)]"}
                disabled={!isDirty || isSaving}
                size="icon-sm"
                title={updateTask.isPending ? "Saving changes" : "Save changes"}
                type="submit"
                variant={isDirty ? "default" : "ghost"}
              >
                <HugeiconsIcon
                  className={updateTask.isPending ? "animate-spin motion-reduce:animate-none" : undefined}
                  icon={updateTask.isPending ? Loading03Icon : Tick02Icon}
                  strokeWidth={1.8}
                />
              </Button>
              <Button
                aria-label="Close task details"
                className="text-[var(--task-detail-muted)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"
                disabled={isSaving}
                onClick={() => clearSelection(interactionTransitionRef.current)}
                size="icon-sm"
                title="Close task details"
                type="button"
                variant="ghost"
              >
                <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} strokeWidth={1.8} />
              </Button>
            </div>
          </div>

          {validationError ? (
            <p
              className="m-0 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs leading-4 text-destructive"
              id="task-detail-validation"
              role="alert"
            >
              {validationError === "title"
                ? "Task title cannot be empty."
                : "Enter a whole number of minutes, or leave the estimate blank."}
            </p>
          ) : null}

          <div className="grid grid-cols-2 border-y border-[var(--task-detail-border)]">
            <div className="min-w-0">
              {editingField === "estimate" ? (
                <div className="flex min-h-14 items-center gap-2 px-4">
                  <HugeiconsIcon aria-hidden="true" className="shrink-0 text-[var(--task-detail-muted)]" icon={Clock01Icon} size={16} strokeWidth={1.7} />
                  <div className="min-w-0 flex-1">
                    <span className="block text-menu-label font-semibold capitalize text-[var(--task-detail-muted)]">Estimate</span>
                    <Input
                      aria-describedby={validationError === "estimate" ? "task-detail-validation" : undefined}
                      aria-invalid={validationError === "estimate"}
                      aria-label="Estimate in minutes"
                      autoFocus
                      className="h-6 border-transparent bg-transparent px-0 text-menu font-normal tabular-nums text-[var(--task-detail-foreground)] shadow-none placeholder:text-[var(--task-detail-muted)] focus-visible:border-ring focus-visible:ring-0"
                      disabled={controlsDisabled}
                      inputMode="numeric"
                      min="1"
                      onBlur={() => setEditingField(null)}
                      onChange={(event) => {
                        setEstimate(event.target.value);
                        if (validationError === "estimate") setValidationError(null);
                      }}
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
                  </div>
                </div>
              ) : (
                <button
                  aria-describedby={validationError === "estimate" ? "task-detail-validation" : undefined}
                  aria-invalid={validationError === "estimate"}
                  aria-label="Edit estimate"
                  className="flex min-h-14 w-full min-w-0 items-center gap-2 px-4 text-left outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 motion-reduce:transition-none"
                  disabled={controlsDisabled}
                  onClick={() => setEditingField("estimate")}
                  type="button"
                >
                  <HugeiconsIcon aria-hidden="true" className="shrink-0 text-[var(--task-detail-muted)]" icon={Clock01Icon} size={16} strokeWidth={1.7} />
                  <span className="min-w-0">
                    <span className="block text-menu-label font-semibold capitalize text-[var(--task-detail-muted)]">Estimate</span>
                    <span className="block truncate text-menu font-normal tabular-nums">
                      {estimate.trim() ? `${estimate.trim()}m` : "Set time"}
                    </span>
                  </span>
                </button>
              )}
            </div>

            <Popover>
              <PopoverTrigger
                render={
                  <button
                    aria-label="Edit due date"
                    className="flex min-h-14 w-full min-w-0 items-center gap-2 border-l border-[var(--task-detail-border)] px-4 text-left outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 motion-reduce:transition-none"
                    disabled={controlsDisabled}
                    title="Edit due date"
                    type="button"
                  />
                }
              >
                <HugeiconsIcon aria-hidden="true" className="shrink-0 text-[var(--task-detail-muted)]" icon={Calendar01Icon} size={16} strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className="block text-menu-label font-semibold capitalize text-[var(--task-detail-muted)]">Date</span>
                  <span className="block truncate text-menu font-normal">{formatDueDate(scheduledDate)}</span>
                </span>
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
                {scheduledDate !== null ? (
                  <div className="border-t border-border p-2">
                    <Button
                      className="w-full justify-center text-menu"
                      onClick={() => setScheduledDate(null)}
                      type="button"
                      variant="ghost"
                    >
                      Return to Backlog
                    </Button>
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>

          {activeTask.completedAt === null && activeTask.estimateMinutes !== null && activeTask.scheduledDate === planner.data?.today ? (
            <button
              aria-label={anchorDate === planner.data.today ? "Remove Anchor for today" : "Anchor task for today"}
              aria-pressed={anchorDate === planner.data.today}
              className="flex min-h-10 w-full items-center gap-2 border-b border-[var(--task-detail-border)] px-4 text-left text-menu outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 motion-reduce:transition-none"
              disabled={controlsDisabled}
              onClick={() => setAnchorDate(anchorDate === planner.data?.today ? null : planner.data?.today ?? null)}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" className="text-[var(--task-detail-muted)]" icon={BookmarkCheck01Icon} size={16} strokeWidth={1.7} />
              <span className="font-normal">Anchor for today</span>
              <span className="ml-auto text-menu-label font-semibold text-[var(--task-detail-muted)]">
                {anchorDate === planner.data.today ? "Anchored" : "Not anchored"}
              </span>
            </button>
          ) : null}

          <div className="flex min-h-12 items-center gap-2 px-4 py-2">
            {deleteArmed ? (
              <>
                <span className="min-w-0 flex-1 text-xs leading-4 text-[var(--task-detail-muted)]">Delete this task?</span>
                <Button
                  className="text-menu font-normal text-[var(--task-detail-muted)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"
                  disabled={isSaving}
                  onClick={() => setDeleteArmed(false)}
                  ref={keepTaskButtonRef}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Keep
                </Button>
                <Button
                  aria-label={deleteTask.isPending ? "Deleting task" : "Confirm delete task"}
                  aria-pressed="true"
                  className="text-menu font-medium"
                  disabled={isSaving}
                  onClick={handleDelete}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  {deleteTask.isPending ? (
                    <HugeiconsIcon className="animate-spin motion-reduce:animate-none" icon={Loading03Icon} strokeWidth={1.7} />
                  ) : null}
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="px-2 text-menu font-normal text-[var(--task-detail-muted)] hover:bg-destructive/10 hover:text-destructive"
                  disabled={isSaving}
                  onClick={handleDelete}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Delete
                </Button>
                {movementAction ? (
                  <Button
                    aria-busy={setTaskScheduledDate.isPending}
                    aria-label={movementAction === "today" ? "Commit task to Today" : "Return task to Backlog"}
                    className="ml-auto min-w-0 flex-1 justify-between px-3 text-menu font-medium"
                    disabled={controlsDisabled || isDirty}
                    onClick={handleMovement}
                    title={isDirty ? "Save changes before moving this task" : undefined}
                    type="button"
                    variant={movementAction === "today" ? "default" : "outline"}
                  >
                    <span className="truncate">
                      {setTaskScheduledDate.isPending
                        ? "Moving task…"
                        : movementAction === "today"
                          ? "Commit to Today"
                          : "Return to Backlog"}
                    </span>
                    <HugeiconsIcon
                      aria-hidden="true"
                      className={setTaskScheduledDate.isPending ? "animate-spin motion-reduce:animate-none" : undefined}
                      icon={
                        setTaskScheduledDate.isPending
                          ? Loading03Icon
                          : movementAction === "today"
                            ? ArrowDown01Icon
                            : ArrowUp01Icon
                      }
                      strokeWidth={1.7}
                    />
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div
            animate="visible"
            className="flex w-full min-w-0 flex-wrap items-center gap-1 px-3 py-3"
            initial={transition === "animate" ? "hidden" : false}
            variants={panelContentVariants}
          >
            <div className="min-w-0 basis-full">
              {editingField === "title" ? (
                <Input
                  aria-label="Task title"
                  autoFocus
                  className="h-8 border-[var(--task-detail-border)] bg-[var(--task-detail-field)] text-[var(--task-detail-foreground)] capitalize placeholder:normal-case placeholder:text-[var(--task-detail-muted)] focus-visible:border-ring"
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
                  className="flex h-8 w-full items-center truncate rounded-md px-2 text-left text-menu font-medium capitalize outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
                  disabled={controlsDisabled}
                  onClick={() => setEditingField("title")}
                  type="button"
                >
                  {title || "Untitled task"}
                </button>
              )}
            </div>

            <div className="mt-1 flex w-full flex-wrap items-center gap-1">
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
                  className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-menu tabular-nums outline-none transition-colors duration-150 hover:bg-[var(--task-detail-field)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
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
                  {scheduledDate !== null ? (
                    <div className="border-t border-border p-2">
                      <Button
                        className="w-full justify-center text-menu"
                        onClick={() => setScheduledDate(null)}
                        type="button"
                        variant="ghost"
                      >
                        Return to Backlog
                      </Button>
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>

              {activeTask.completedAt === null && activeTask.estimateMinutes !== null && activeTask.scheduledDate === planner.data?.today ? (
                <Button
                  aria-label={anchorDate === planner.data.today ? "Remove Anchor for today" : "Anchor task for today"}
                  aria-pressed={anchorDate === planner.data.today}
                  className={anchorDate === planner.data.today ? "text-primary" : "text-[var(--task-detail-muted)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"}
                  disabled={controlsDisabled}
                  onClick={() => setAnchorDate(anchorDate === planner.data?.today ? null : planner.data?.today ?? null)}
                  size="icon-sm"
                  title={anchorDate === planner.data.today ? "Remove Anchor for today" : "Anchor for today"}
                  type="button"
                  variant="ghost"
                >
                  <HugeiconsIcon aria-hidden="true" icon={BookmarkCheck01Icon} strokeWidth={1.7} />
                </Button>
              ) : null}

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
                  aria-label={updateTask.isPending ? "Saving changes" : "Save changes"}
                  className={isDirty ? undefined : "text-[var(--task-detail-muted)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-muted)]"}
                  disabled={!isDirty || isSaving}
                  size="icon-sm"
                  title={updateTask.isPending ? "Saving changes" : "Save changes"}
                  type="submit"
                  variant={isDirty ? "default" : "ghost"}
                >
                  <HugeiconsIcon
                    className={updateTask.isPending ? "animate-spin motion-reduce:animate-none" : undefined}
                    icon={updateTask.isPending ? Loading03Icon : Tick02Icon}
                    strokeWidth={1.7}
                  />
                </Button>
              )}
            </div>
          </motion.div>
          {movementAction ? (
            <div className="border-t border-[var(--task-detail-border)] px-4 py-2 sm:px-6">
              <Button
                aria-busy={setTaskScheduledDate.isPending}
                aria-label={movementAction === "today" ? "Commit task to Today" : "Return task to Backlog"}
                className="w-full justify-between text-menu"
                disabled={controlsDisabled || isDirty}
                onClick={handleMovement}
                title={isDirty ? "Save changes before moving this task" : undefined}
                type="button"
                variant={movementAction === "today" ? "default" : "outline"}
              >
                <span>
                  {setTaskScheduledDate.isPending
                    ? "Moving task…"
                    : movementAction === "today"
                      ? "Commit to Today"
                      : "Return to Backlog"}
                </span>
                <HugeiconsIcon
                  aria-hidden="true"
                  className={setTaskScheduledDate.isPending ? "animate-spin motion-reduce:animate-none" : undefined}
                  icon={
                    setTaskScheduledDate.isPending
                      ? Loading03Icon
                      : movementAction === "today"
                        ? ArrowDown01Icon
                        : ArrowUp01Icon
                  }
                  strokeWidth={1.7}
                />
              </Button>
            </div>
          ) : null}
        </>
      )}
      <span aria-live="polite" className="sr-only">
        {deleteArmed ? "Delete confirmation. Choose Keep task or Confirm delete task." : ""}
      </span>
    </motion.form>
  );
}
