import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar01Icon,
  Clock01Icon,
  Delete02Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import {
  useDeleteTask,
  useSetTaskCompleted,
  useUpdateTask,
} from "@/lib/planner-query";
import { planningTasks, type LocalDate, type PlannerSnapshot, type PlanningTask } from "@/lib/planner";
import { PLANNING_LANES, taskPlanningLane, type PlanningLaneId } from "@/lib/planning-board";

export function PlanningTaskSheet({ snapshot }: { snapshot: PlannerSnapshot }) {
  const { clearSelection, selectedTaskId } = useTaskSelection();
  const task = selectedTaskId
    ? planningTasks(snapshot).find((candidate) => candidate.id === selectedTaskId)
    : undefined;

  return (
    <Sheet open={Boolean(selectedTaskId && task)} onOpenChange={(open) => !open && clearSelection()}>
      {task ? <PlanningTaskSheetContent key={task.id} snapshot={snapshot} task={task} /> : null}
    </Sheet>
  );
}

function PlanningTaskSheetContent({ snapshot, task }: { snapshot: PlannerSnapshot; task: PlanningTask }) {
  const { clearSelection } = useTaskSelection();
  const updateTask = useUpdateTask();
  const completeTask = useSetTaskCompleted();
  const deleteTask = useDeleteTask();
  const [title, setTitle] = useState(task.title);
  const [estimate, setEstimate] = useState(task.estimateMinutes?.toString() ?? "");
  const [scheduledDate, setScheduledDate] = useState<LocalDate | null>(task.scheduledDate);
  const [lane, setLane] = useState<PlanningLaneId>(taskPlanningLane(task, snapshot.today));
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const revisionRef = useRef(task.revision);
  const initialLane = taskPlanningLane(task, snapshot.today);
  const parsedEstimate = useMemo(() => {
    const value = estimate.trim();
    if (!value) return null;
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes > 0 ? minutes : undefined;
  }, [estimate]);
  const isDirty =
    title !== task.title
    || estimate.trim() !== (task.estimateMinutes?.toString() ?? "")
    || scheduledDate !== task.scheduledDate
    || lane !== initialLane;
  const isPending = updateTask.isPending || completeTask.isPending || deleteTask.isPending;

  useEffect(() => {
    if (task.revision === revisionRef.current) return;
    if (isDirty) {
      setIsStale(true);
      return;
    }

    revisionRef.current = task.revision;
    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setLane(taskPlanningLane(task, snapshot.today));
  }, [isDirty, snapshot.today, task]);

  function applyLane(nextLane: PlanningLaneId) {
    if (task.completedAt || nextLane === "done") return;
    setLane(nextLane);
    if (nextLane === "capture") {
      setEstimate("");
      if (scheduledDate === snapshot.today) setScheduledDate(null);
    } else if (nextLane === "ready") {
      if (scheduledDate === snapshot.today) setScheduledDate(null);
    } else if (nextLane === "today") {
      setScheduledDate(snapshot.today);
    }
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Task title cannot be empty.");
      return;
    }
    if (parsedEstimate === undefined) {
      toast.error("Enter a whole number of minutes, or leave the estimate blank.");
      return;
    }
    if (lane === "ready" && parsedEstimate === null) {
      toast.error("Ready tasks need an estimate.");
      return;
    }

    const estimateMinutes = lane === "capture" ? null : parsedEstimate;
    const nextDate = lane === "today" ? snapshot.today : scheduledDate;
    updateTask.mutate(
      {
        id: task.id,
        title: trimmedTitle,
        estimateMinutes,
        scheduledDate: nextDate,
        anchorDate: task.anchorDate,
        expectedRevision: revisionRef.current,
      },
      {
        onSuccess: () => {
          clearSelection();
          toast.success("Task updated.");
        },
        onError: (error) => toast.error(plannerMutationErrorMessage(error, "Could not update task.")),
      },
    );
  }

  function toggleCompletion() {
    if (isDirty) return;
    completeTask.mutate(
      { id: task.id, completed: task.completedAt === null, expectedRevision: revisionRef.current },
      {
        onSuccess: () => {
          clearSelection();
          toast.success(task.completedAt ? "Task reopened." : "Task completed.");
        },
        onError: (error) => toast.error(plannerMutationErrorMessage(error, "Could not update completion.")),
      },
    );
  }

  function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    deleteTask.mutate(
      { id: task.id, expectedRevision: revisionRef.current },
      {
        onSuccess: () => {
          clearSelection();
          toast.success("Task deleted.");
        },
        onError: (error) => toast.error(plannerMutationErrorMessage(error, "Could not delete task.")),
      },
    );
  }

  function reviewLatest() {
    revisionRef.current = task.revision;
    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setLane(taskPlanningLane(task, snapshot.today));
    setIsStale(false);
  }

  return (
    <SheetContent
      className="w-[min(380px,calc(100vw-24px))] gap-0 bg-popover sm:max-w-[380px]"
      data-task-sheet
      onKeyDown={(event) => {
        if (event.key === "Escape" && deleteArmed) {
          event.preventDefault();
          event.stopPropagation();
          setDeleteArmed(false);
        }
      }}
      side="right"
    >
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle>Task</SheetTitle>
        <SheetDescription>Edit its planning facts or move it through the ledger.</SheetDescription>
      </SheetHeader>

      {isStale ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-5 py-2 text-xs">
          <span>This task changed elsewhere.</span>
          <Button onClick={reviewLatest} size="xs" type="button" variant="outline">Review latest</Button>
        </div>
      ) : null}

      <form className="flex min-h-0 flex-1 flex-col" id="planning-task-form" onSubmit={save}>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <Field label="Title">
            <Input
              aria-label="Task title"
              disabled={isPending || isStale}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </Field>

          <Field label="Estimate">
            <div className="relative">
              <HugeiconsIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2 text-muted-foreground" icon={Clock01Icon} size={14} strokeWidth={1.7} />
              <Input
                aria-label="Estimate in minutes"
                className="pl-8 font-mono tabular-nums"
                disabled={isPending || isStale || lane === "capture" || task.completedAt !== null}
                inputMode="numeric"
                min="1"
                onChange={(event) => setEstimate(event.target.value)}
                placeholder="Minutes"
                type="number"
                value={estimate}
              />
            </div>
          </Field>

          <Field label="Date">
            <div className="relative">
              <HugeiconsIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2 text-muted-foreground" icon={Calendar01Icon} size={14} strokeWidth={1.7} />
              <Input
                aria-label="Task date"
                className="pl-8"
                disabled={isPending || isStale || task.completedAt !== null}
                onChange={(event) => {
                  const nextDate = (event.target.value || null) as LocalDate | null;
                  setScheduledDate(nextDate);
                  if (nextDate === snapshot.today) setLane("today");
                  else if (lane === "today") setLane(estimate.trim() ? "ready" : "capture");
                }}
                type="date"
                value={scheduledDate ?? ""}
              />
            </div>
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-menu-label font-semibold text-muted-foreground">Move to</legend>
            <ToggleGroup
              aria-label="Planning lane"
              className="grid w-full grid-cols-4 gap-0"
              onValueChange={(values) => {
                const nextLane = values[values.length - 1] as PlanningLaneId | undefined;
                if (nextLane) applyLane(nextLane);
              }}
              spacing={0}
              value={[lane]}
              variant="outline"
            >
              {PLANNING_LANES.map((laneId) => (
                <ToggleGroupItem
                  aria-label={`Move to ${laneLabel(laneId)}`}
                  className="h-8 min-w-0 px-1 text-xs"
                  disabled={isPending || isStale || (task.completedAt !== null && laneId !== "done") || (task.completedAt === null && laneId === "done")}
                  key={laneId}
                  value={laneId}
                >
                  {laneLabel(laneId)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="m-0 text-metadata leading-4 text-muted-foreground">
              {task.completedAt
                ? "Reopen this task before moving it to an active lane."
                : lane === "capture"
                  ? "Capture keeps the task unestimated; its date is optional."
                  : lane === "ready"
                    ? "Ready requires an estimate; its date is optional."
                    : "Today commits the task to the current day."}
            </p>
          </fieldset>
        </div>
      </form>

      <SheetFooter className="border-t border-border p-4">
        {isDirty ? (
          <Button disabled={isPending || isStale} form="planning-task-form" type="submit">
            {updateTask.isPending ? <HugeiconsIcon className="animate-spin motion-reduce:animate-none" icon={Loading03Icon} strokeWidth={1.8} /> : null}
            Save changes
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={isPending || isDirty || isStale} onClick={toggleCompletion} type="button" variant={task.completedAt ? "outline" : "default"}>
            <HugeiconsIcon icon={completeTask.isPending ? Loading03Icon : Tick02Icon} strokeWidth={1.8} />
            {task.completedAt ? "Reopen" : "Mark complete"}
          </Button>
          <Button disabled={isPending} onClick={handleDelete} type="button" variant={deleteArmed ? "destructive" : "outline"}>
            <HugeiconsIcon icon={deleteTask.isPending ? Loading03Icon : Delete02Icon} strokeWidth={1.8} />
            {deleteArmed ? "Confirm delete" : "Delete task"}
          </Button>
        </div>
        {deleteArmed ? (
          <Button disabled={isPending} onClick={() => setDeleteArmed(false)} size="sm" type="button" variant="ghost">Keep task</Button>
        ) : null}
      </SheetFooter>
    </SheetContent>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block space-y-2">
      <span className="block text-menu-label font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function laneLabel(lane: PlanningLaneId) {
  return lane[0].toUpperCase() + lane.slice(1);
}
