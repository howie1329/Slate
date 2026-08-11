import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar01Icon,
  Cancel01Icon,
  Delete02Icon,
  Loading03Icon,
  MoreHorizontalIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dateFromLocalDate, localDateFromDate } from "@/lib/local-date";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import { planningInteraction } from "@/lib/planning-interaction";
import {
  useDeleteTask,
  useSetTaskCompleted,
  useUpdateTask,
} from "@/lib/planner-query";
import type { LocalDate, PlannerSnapshot, PlanningTask } from "@/lib/planner";
import { PLANNING_LANES, type PlanningLaneId } from "@/lib/planning-board";

type PlanningTaskInspectorProps = {
  draftLane?: PlanningLaneId | null;
  initialLane: PlanningLaneId;
  snapshot: PlannerSnapshot;
  task: PlanningTask;
};

export function PlanningTaskInspector({
  draftLane,
  initialLane,
  snapshot,
  task,
}: PlanningTaskInspectorProps) {
  const { clearSelection } = useTaskSelection();
  const updateTask = useUpdateTask();
  const completeTask = useSetTaskCompleted();
  const deleteTask = useDeleteTask();
  const [title, setTitle] = useState(task.title);
  const [estimate, setEstimate] = useState(task.estimateMinutes?.toString() ?? "");
  const [scheduledDate, setScheduledDate] = useState<LocalDate | null>(task.scheduledDate);
  const [lane, setLane] = useState<PlanningLaneId>(draftLane ?? initialLane);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const baselineRef = useRef({
    estimate: task.estimateMinutes?.toString() ?? "",
    lane: initialLane,
    scheduledDate: task.scheduledDate,
    title: task.title,
  });
  const revisionRef = useRef(task.revision);
  const parsedEstimate = useMemo(() => {
    const value = estimate.trim();
    if (!value) return null;
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes > 0 ? minutes : undefined;
  }, [estimate]);
  const trimmedTitle = title.trim();
  const titleInvalid = trimmedTitle.length === 0;
  const estimateInvalid = parsedEstimate === undefined || (lane === "ready" && parsedEstimate === null);
  const isDirty =
    title !== baselineRef.current.title
    || estimate.trim() !== baselineRef.current.estimate
    || scheduledDate !== baselineRef.current.scheduledDate
    || lane !== baselineRef.current.lane;
  const isPending = updateTask.isPending || completeTask.isPending || deleteTask.isPending;
  const controlsDisabled = isPending || isStale;

  useEffect(() => {
    if (task.revision === revisionRef.current) return;
    if (isDirty) {
      setIsStale(true);
      return;
    }

    revisionRef.current = task.revision;
    baselineRef.current = {
      estimate: task.estimateMinutes?.toString() ?? "",
      lane: initialLane,
      scheduledDate: task.scheduledDate,
      title: task.title,
    };
    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setLane(initialLane);
  }, [initialLane, isDirty, task]);

  function closeInspector() {
    const taskId = task.id;
    clearSelection();
    window.requestAnimationFrame(() => {
      const selectedCard = Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"))
        .find((element) => element.dataset.taskId === taskId);
      selectedCard?.focus();
    });
  }

  function applyLane(nextLane: PlanningLaneId) {
    if (task.completedAt || nextLane === "done") return;
    const result = planningInteraction({
      kind: "lane-draft",
      task,
      destination: nextLane,
      today: snapshot.today,
      draft: { estimate, scheduledDate },
    });
    if (result.kind !== "lane-draft") return;
    setLane(nextLane);
    setEstimate(result.draft.estimate);
    setScheduledDate(result.draft.scheduledDate);
  }

  function setDate(nextDate: LocalDate | null) {
    setScheduledDate(nextDate);
    if (nextDate === snapshot.today) {
      setLane("today");
    } else if (lane === "today") {
      setLane(estimate.trim() ? "ready" : "capture");
    }
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (titleInvalid) {
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
        onSuccess: () => clearSelection(),
        onError: (error) => toast.error(plannerMutationErrorMessage(error, "Could not update task.")),
      },
    );
  }

  function toggleCompletion() {
    if (isDirty) return;
    completeTask.mutate(
      { id: task.id, completed: task.completedAt === null, expectedRevision: revisionRef.current },
      {
        onSuccess: () => clearSelection(),
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
        onSuccess: () => clearSelection(),
        onError: (error) => toast.error(plannerMutationErrorMessage(error, "Could not delete task.")),
      },
    );
  }

  function reviewLatest() {
    revisionRef.current = task.revision;
    baselineRef.current = {
      estimate: task.estimateMinutes?.toString() ?? "",
      lane: initialLane,
      scheduledDate: task.scheduledDate,
      title: task.title,
    };
    setTitle(task.title);
    setEstimate(task.estimateMinutes?.toString() ?? "");
    setScheduledDate(task.scheduledDate);
    setLane(initialLane);
    setIsStale(false);
  }

  return (
    <form
      aria-label={`Edit ${task.title}`}
      className="flex h-full min-h-0 flex-col bg-background"
      data-task-inspector
      id="planning-task-form"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (deleteArmed) setDeleteArmed(false);
          else closeInspector();
          return;
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && isDirty) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
      onSubmit={save}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="text-section-secondary font-medium">Task details</span>
        <span className="ml-auto text-estimate text-muted-foreground">{laneLabel(lane)}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Close task details"
                onClick={closeInspector}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.8} />
          </TooltipTrigger>
          <TooltipContent>Close task details</TooltipContent>
        </Tooltip>
      </header>

      {isStale ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-xs" role="status">
          <span>This task changed elsewhere.</span>
          <Button onClick={reviewLatest} size="xs" type="button" variant="outline">Review latest</Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="planning-task-title">Task title</label>
          <Textarea
            aria-invalid={titleInvalid}
            autoFocus
            className="min-h-10 resize-none border-transparent px-0 py-0 text-lg font-semibold leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0"
            disabled={controlsDisabled}
            id="planning-task-title"
            maxLength={500}
            onChange={(event) => setTitle(event.target.value)}
            rows={1}
            value={title}
          />
          <p className="m-0 text-capacity text-muted-foreground">
            {taskSummary(lane, estimate)}
          </p>
          {titleInvalid ? <p className="m-0 text-xs text-destructive">Enter a task title.</p> : null}
        </div>

        <section aria-labelledby="planning-task-properties" className="mt-6 border-t border-border pt-4">
          <h2 className="m-0 text-section-secondary font-semibold" id="planning-task-properties">Planning</h2>
          <div className="mt-4 flex flex-col gap-3">
            <PropertyRow label="Estimate" labelFor="planning-task-estimate">
              <div className="flex min-w-0 flex-col gap-1">
                <InputGroup aria-invalid={estimateInvalid}>
                  <InputGroupInput
                    aria-invalid={estimateInvalid}
                    disabled={controlsDisabled || lane === "capture" || task.completedAt !== null}
                    id="planning-task-estimate"
                    inputMode="numeric"
                    min="1"
                    onChange={(event) => setEstimate(event.target.value)}
                    placeholder="None"
                    type="number"
                    value={estimate}
                  />
                  <InputGroupAddon>min</InputGroupAddon>
                </InputGroup>
                {estimateInvalid ? (
                  <p className="m-0 text-metadata leading-3 text-destructive">
                    {lane === "ready" && parsedEstimate === null ? "Ready needs an estimate." : "Use whole minutes."}
                  </p>
                ) : null}
              </div>
            </PropertyRow>

            <PropertyRow label="Date">
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      aria-label="Edit task date"
                      className="w-full min-w-0 justify-start"
                      disabled={controlsDisabled || task.completedAt !== null}
                      type="button"
                      variant="outline"
                    />
                  }
                >
                  <HugeiconsIcon data-icon="inline-start" icon={Calendar01Icon} strokeWidth={1.7} />
                  <span className="truncate">{formatInspectorDate(scheduledDate)}</span>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0" data-task-calendar side="bottom" sideOffset={8}>
                  <Calendar
                    mode="single"
                    onSelect={(date) => {
                      if (date) setDate(localDateFromDate(date));
                    }}
                    selected={scheduledDate ? dateFromLocalDate(scheduledDate) : undefined}
                  />
                  {scheduledDate ? (
                    <div className="border-t border-border p-2">
                      <Button className="w-full" onClick={() => setDate(null)} size="sm" type="button" variant="ghost">
                        Clear date
                      </Button>
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>
            </PropertyRow>

            <PropertyRow label="Lane">
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
                    disabled={controlsDisabled || (task.completedAt !== null && laneId !== "done") || (task.completedAt === null && laneId === "done")}
                    key={laneId}
                    value={laneId}
                  >
                    {laneLabel(laneId)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </PropertyRow>
          </div>
        </section>
      </div>

      <footer className="shrink-0 border-t border-border bg-background p-4">
        {deleteArmed ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2">
            <span className="text-xs text-destructive">Delete this task permanently?</span>
            <div className="flex shrink-0 gap-1">
              <Button disabled={isPending} onClick={() => setDeleteArmed(false)} size="xs" type="button" variant="ghost">Keep</Button>
              <Button disabled={isPending} onClick={handleDelete} size="xs" type="button" variant="destructive">
                {deleteTask.isPending ? <HugeiconsIcon data-icon="inline-start" icon={Loading03Icon} strokeWidth={1.8} /> : null}
                Delete
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={isPending || isDirty || isStale}
            onClick={toggleCompletion}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon data-icon="inline-start" icon={completeTask.isPending ? Loading03Icon : Tick02Icon} strokeWidth={1.8} />
            {task.completedAt ? "Reopen" : "Mark complete"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="More task actions"
                  disabled={isPending}
                  size="icon"
                  title="More task actions"
                  type="button"
                  variant="outline"
                />
              }
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.8} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setDeleteArmed(true)} variant="destructive">
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.8} />
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isDirty ? (
          <Button className="mt-2 w-full" disabled={isPending || isStale || titleInvalid || estimateInvalid} type="submit">
            {updateTask.isPending ? <HugeiconsIcon data-icon="inline-start" icon={Loading03Icon} strokeWidth={1.8} /> : null}
            Save changes
            <span className="ml-auto text-metadata opacity-60">⌘↵</span>
          </Button>
        ) : null}
      </footer>
    </form>
  );
}

function PropertyRow({
  children,
  label,
  labelFor,
}: {
  children: React.ReactNode;
  label: string;
  labelFor?: string;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3">
      {labelFor ? (
        <label className="pt-2 text-xs text-muted-foreground" htmlFor={labelFor}>{label}</label>
      ) : (
        <span className="pt-2 text-xs text-muted-foreground">{label}</span>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function taskSummary(lane: PlanningLaneId, estimate: string) {
  const state = lane === "today" ? "Committed today" : lane === "done" ? "Completed" : laneLabel(lane);
  const minutes = Number(estimate);
  if (!estimate.trim() || !Number.isFinite(minutes)) return state;
  return `${state} · ${formatMinutes(minutes)}`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!remainder) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${hours}h ${remainder}m`;
}

function formatInspectorDate(value: LocalDate | null) {
  if (!value) return "No date";
  return dateFromLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function laneLabel(lane: PlanningLaneId) {
  return lane[0].toUpperCase() + lane.slice(1);
}
