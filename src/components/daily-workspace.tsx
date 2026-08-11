import { useState } from "react";
import NumberFlow from "@number-flow/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, InboxIcon, Sun01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { DailyCommandBar } from "@/components/daily-command-bar";
import { PlannerEmptyState } from "@/components/planner-empty-state";
import { TaskGroup } from "@/components/task-group";
import { useTaskMotion, type TaskMotionKind, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import type { DailyWorkspaceModel } from "@/lib/daily-workspace";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import { planningTasks, type CapacityView, type PlannerSnapshot, type Task } from "@/lib/planner";
import { useDailyWorkspace, useSetTaskCompleted } from "@/lib/planner-query";
import { formatMinutes } from "@/lib/task-groups";
import { useWindowMode } from "@/lib/window-mode";

const numberTransformTiming = { duration: 180, easing: "ease-out" };
const numberOpacityTiming = { duration: 120, easing: "ease-out" };

export function DailyWorkspace() {
  const windowMode = useWindowMode();
  const [query, setQuery] = useState("");
  const { planner, view, isReordering, reorderToday } = useDailyWorkspace(query);

  if (!planner.data || !view) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <DailyCommandBar onValueChange={setQuery} value={query} windowMode={windowMode} />
        <DailyWorkspaceLoading />
      </div>
    );
  }

  return (
    <DailyWorkspaceContent
      planner={planner.data}
      query={query}
      model={view}
      isReordering={isReordering}
      reorderToday={reorderToday}
      setQuery={setQuery}
      windowMode={windowMode}
    />
  );
}

type DailyWorkspaceContentProps = {
  planner: PlannerSnapshot;
  query: string;
  model: DailyWorkspaceModel;
  isReordering: boolean;
  reorderToday: (taskIds: string[], options?: { onError?: (error: unknown) => void }) => void;
  setQuery: (value: string) => void;
  windowMode: ReturnType<typeof useWindowMode>;
};

function DailyWorkspaceContent({ planner, query, model, isReordering, reorderToday, setQuery, windowMode }: DailyWorkspaceContentProps) {
  const setTaskCompleted = useSetTaskCompleted();
  const { clearTaskMutation, recordTaskMutation, taskMutation } = useTaskMotion();
  const { selectedTaskId, selectTask } = useTaskSelection();
  const [backlogExpanded, setBacklogExpanded] = useState(true);
  const mutationPending = setTaskCompleted.isPending || isReordering;

  function toggleTask(taskId: string, transition: TaskMotionTransition = "instant") {
    const task = planningTasks(planner).find((candidate) => candidate.id === taskId);
    if (!task) {
      return;
    }

    const mutationVersion = recordTaskMutation({
      kind: task.completedAt === null ? "complete" : "restore",
      taskId,
      transition,
    });
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null, expectedRevision: task.revision },
      {
        onError: (error) => {
          clearTaskMutation(mutationVersion);
          toast.error(plannerMutationErrorMessage(error, "Could not update task."));
        },
      },
    );
  }

  function handleReorderToday(taskIds: string[]) {
    reorderToday(taskIds, { onError: () => toast.error("Could not save task order.") });
  }

  const todayMetadata = (task: Task) => model.today.active.metadataByTaskId[task.id] ?? [];
  const backlogMetadata = (task: Task) => model.backlog.active.metadataByTaskId[task.id] ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DailyCommandBar onValueChange={setQuery} value={query} windowMode={windowMode} />
      <section
        aria-label="Daily workspace"
        className={`min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 ${selectedTaskId && windowMode === "popover" ? "pb-48" : "pb-10"}`}
      >
        <div className={`mx-auto w-full ${windowMode === "full" ? "max-w-3xl" : "max-w-xl"}`}>
          {model.hasQuery && !model.hasMatches ? (
            <PlannerEmptyState
              actionLabel="Clear search"
              compact
              description="Clear the search to return to the full Daily workspace."
              onAction={() => setQuery("")}
              title="No matching tasks"
              transition={taskMutation?.transition ?? "instant"}
            >
              <HugeiconsIcon aria-hidden="true" icon={InboxIcon} size={20} strokeWidth={1.8} />
            </PlannerEmptyState>
          ) : (
            <>
              <section aria-labelledby="daily-today-heading" className="sticky top-0 z-1 -mx-4 bg-background px-4 pb-2 pt-3 sm:-mx-6 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <HugeiconsIcon aria-hidden="true" className="shrink-0 text-foreground" icon={Sun01Icon} size={16} strokeWidth={1.8} />
                  <h1 className="m-0 font-heading text-menu font-semibold" id="daily-today-heading">
                    Today
                  </h1>
                  <span
                    aria-label={`${model.today.totalTaskCount} ${model.today.totalTaskCount === 1 ? "task" : "tasks"} in Today`}
                    className="inline-flex min-w-5 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 text-estimate tabular-nums text-muted-foreground"
                    role="status"
                  >
                    <NumberFlow
                      aria-hidden="true"
                      opacityTiming={numberOpacityTiming}
                      respectMotionPreference
                      transformTiming={numberTransformTiming}
                      value={model.today.totalTaskCount}
                    />
                  </span>
                  <p
                    aria-label={capacityStatus(model.today.capacity)}
                    className={`m-0 ml-auto shrink-0 text-capacity tabular-nums ${model.today.capacity.isOverCapacity ? "text-destructive" : "text-muted-foreground"}`}
                    role="status"
                  >
                    {capacityLabel(model.today.capacity)}
                  </p>
                </div>
                <div
                  aria-label={`${model.today.capacity.committedMinutes} of ${model.today.capacity.limitMinutes} minutes committed`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={capacityPercentage(model.today.capacity.committedMinutes, model.today.capacity.limitMinutes)}
                  aria-valuetext={capacityStatus(model.today.capacity)}
                  className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                >
                  <span
                    className={`block h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${model.today.capacity.isOverCapacity ? "bg-destructive/80" : "bg-primary/70"}`}
                    style={{ width: `${capacityPercentage(model.today.capacity.committedMinutes, model.today.capacity.limitMinutes)}%` }}
                  />
                </div>
              </section>

              {model.today.active.tasks.length > 0 || model.today.completed.tasks.length > 0 ? (
                <TaskGroup
                  activeLabel="Committed today"
                  className="mt-0"
                  compact
                  completedLabel="Completed today"
                  completedTasks={model.today.completed.tasks}
                  hideLabel
                  label="Today tasks"
                  metadataForTask={todayMetadata}
                  onReorderTasks={windowMode === "popover" || model.hasQuery ? undefined : handleReorderToday}
                  onSelectTask={selectTask}
                  onToggleTask={toggleTask}
                  overflowTaskId={model.today.capacity.overflowTaskId}
                  pending={mutationPending}
                  reorderDisabled={mutationPending || model.hasQuery}
                  selectedTaskId={selectedTaskId}
                  taskMutation={taskMutation}
                  tasks={model.today.active.tasks}
                />
              ) : (
                <PlannerEmptyState
                  actionLabel="Add a task"
                  compact
                  description="Capture work above, then commit it to Today from its details."
                  onAction={() => document.getElementById("task-composer-input")?.focus()}
                  title="Your day is open"
                  transition={taskMutation?.transition ?? "instant"}
                >
                  <HugeiconsIcon aria-hidden="true" icon={Sun01Icon} size={20} strokeWidth={1.8} />
                </PlannerEmptyState>
              )}

              <section aria-labelledby="daily-backlog-heading" className="mt-4 border-t border-border">
                <button
                  aria-controls="daily-backlog-list"
                  aria-expanded={backlogExpanded}
                  aria-label={`${backlogExpanded ? "Collapse" : "Expand"} Backlog, ${model.backlog.totalTaskCount} tasks`}
                  className="flex h-10 w-full items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => setBacklogExpanded((expanded) => !expanded)}
                  type="button"
                >
                  <HugeiconsIcon aria-hidden="true" className="shrink-0 text-muted-foreground" icon={InboxIcon} size={16} strokeWidth={1.8} />
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-heading text-menu font-semibold" id="daily-backlog-heading">Backlog</span>
                    <span aria-label={`${model.backlog.totalTaskCount} ${model.backlog.totalTaskCount === 1 ? "task" : "tasks"} in backlog`} className="inline-flex min-w-5 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 text-estimate tabular-nums text-muted-foreground" role="status">
                      <NumberFlow
                        aria-hidden="true"
                        opacityTiming={numberOpacityTiming}
                        respectMotionPreference
                        transformTiming={numberTransformTiming}
                        value={model.backlog.totalTaskCount}
                      />
                    </span>
                  </span>
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="ml-auto text-muted-foreground"
                    icon={backlogExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                    size={12}
                    strokeWidth={1.8}
                  />
                </button>
                <div
                  aria-hidden={!backlogExpanded}
                  aria-labelledby="daily-backlog-heading"
                  className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${backlogExpanded ? "grid-rows-[1fr] opacity-100" : "pointer-events-none invisible grid-rows-[0fr] opacity-0"}`}
                  id="daily-backlog-list"
                  role="region"
                >
                  <div className="min-h-0 overflow-hidden">
                    {model.backlog.active.tasks.length > 0 || model.backlog.completed.tasks.length > 0 ? (
                      <TaskGroup
                        className="mt-0"
                        compact
                        completedTasks={model.backlog.completed.tasks}
                        hideLabel
                        label="Backlog tasks"
                        metadataForTask={(task) => backlogMetadata(task)}
                        onSelectTask={selectTask}
                        onToggleTask={toggleTask}
                        pending={mutationPending}
                        selectedTaskId={selectedTaskId}
                        taskMutation={taskMutation}
                        tasks={model.backlog.active.tasks}
                      />
                    ) : (
                      <p className="m-0 py-4 text-center text-xs text-muted-foreground">Backlog is clear.</p>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
      <span aria-live="polite" className="sr-only" role="status">
        {taskMutation ? taskMutationStatus(taskMutation.kind) : ""}
      </span>
    </div>
  );
}

function DailyWorkspaceLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading Daily workspace"
      className="min-h-0 flex-1 overflow-hidden px-4 pb-10 sm:px-6"
      role="status"
    >
      <div className="mx-auto w-full max-w-xl animate-pulse space-y-3 pt-4 motion-reduce:animate-none">
        <div className="flex items-center gap-2">
          <div className="size-4 rounded-full bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="ml-auto h-3 w-28 rounded bg-muted" />
        </div>
        <div className="h-0.5 w-full rounded-full bg-muted" />
        <div className="space-y-1 border-t border-border pt-3">
          {["w-4/5", "w-3/5", "w-2/3", "w-1/2"].map((width) => (
            <div className="flex h-10 items-center gap-3 border-b border-border" key={width}>
              <div className="size-5 rounded-full bg-muted" />
              <div className={`h-3 rounded bg-muted ${width}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function capacityPercentage(committedMinutes: number, capacityMinutes: number) {
  return capacityMinutes > 0 ? Math.min((committedMinutes / capacityMinutes) * 100, 100) : 0;
}

function capacityStatus(capacity: CapacityView) {
  return capacity.isOverCapacity ? `${capacity.overageMinutes} min over capacity` : `${capacity.remainingMinutes} min remaining`;
}

function capacityLabel(capacity: CapacityView) {
  const minutes = capacity.isOverCapacity ? capacity.overageMinutes : capacity.remainingMinutes;
  return `${formatMinutes(minutes)} ${capacity.isOverCapacity ? "over capacity" : "remaining"}`;
}

function taskMutationStatus(kind: TaskMotionKind) {
  switch (kind) {
    case "complete":
      return "Updating task completion.";
    case "create":
      return "Adding task to Backlog.";
    case "delete":
      return "Deleting task.";
    case "move":
      return "Moving task between Today and Backlog.";
    case "restore":
      return "Restoring task.";
    case "update":
      return "Saving task changes.";
  }
}
