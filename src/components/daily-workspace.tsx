import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InboxIcon, Sun01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { DailyCommandBar } from "@/components/daily-command-bar";
import { TaskGroup } from "@/components/task-group";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { selectDailyWorkspace } from "@/lib/daily-workspace";
import type { PlannerSnapshot, Task } from "@/lib/planner";
import { usePlannerState, useReorderTasks, useSetTaskCompleted } from "@/lib/planner-query";
import { useWindowMode } from "@/lib/window-mode";

export function DailyWorkspace() {
  const planner = usePlannerState();
  const windowMode = useWindowMode();
  const [query, setQuery] = useState("");

  if (!planner.data) {
    return null;
  }

  return (
    <DailyWorkspaceContent
      planner={planner.data}
      query={query}
      setQuery={setQuery}
      windowMode={windowMode}
    />
  );
}

type DailyWorkspaceContentProps = {
  planner: PlannerSnapshot;
  query: string;
  setQuery: (value: string) => void;
  windowMode: ReturnType<typeof useWindowMode>;
};

function DailyWorkspaceContent({ planner, query, setQuery, windowMode }: DailyWorkspaceContentProps) {
  const model = selectDailyWorkspace(planner, query);
  const setTaskCompleted = useSetTaskCompleted();
  const reorderTasks = useReorderTasks();
  const { recordTaskMutation, taskMutation } = useTaskMotion();
  const { selectedTaskId, selectTask } = useTaskSelection();
  const [backlogExpanded, setBacklogExpanded] = useState(true);
  const mutationPending = setTaskCompleted.isPending || reorderTasks.isPending;
  const todayScope = `today:${planner.today}`;

  function toggleTask(taskId: string, transition: TaskMotionTransition = "instant") {
    const task = planner.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return;
    }

    recordTaskMutation({
      kind: task.completedAt === null ? "complete" : "restore",
      taskId,
      transition,
    });
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null, expectedRevision: task.revision },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task.") },
    );
  }

  function handleReorderToday(taskIds: string[]) {
    reorderTasks.mutate(
      {
        scope: todayScope,
        taskIds,
        expectedRevisions: taskIds.map((id) => {
          const task = planner.tasks.find((candidate) => candidate.id === id);
          return { id, revision: task?.revision ?? 0 };
        }),
      },
      { onError: () => toast.error("Could not save task order.") },
    );
  }

  const todayMetadata = (task: Task) => model.today.active.metadataByTaskId[task.id] ?? [];
  const backlogMetadata = (task: Task) => model.backlog.active.metadataByTaskId[task.id] ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DailyCommandBar onValueChange={setQuery} value={query} windowMode={windowMode} />
      <section
        aria-label="Daily workspace"
        className={`min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 ${selectedTaskId ? "pb-48" : ""}`}
      >
        <div className={`mx-auto w-full max-w-xl ${windowMode === "full" ? "max-w-3xl" : ""}`}>
          {model.hasQuery && !model.hasMatches ? (
            <EmptyWorkspaceMessage
              actionLabel="Clear search"
              description="Clear the search to return to the full Daily workspace."
              icon={InboxIcon}
              onAction={() => setQuery("")}
              title="No matching tasks"
            />
          ) : (
            <>
              <section aria-labelledby="daily-today-heading" className="pt-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="m-0 font-heading text-xl font-semibold leading-6 tracking-tight" id="daily-today-heading">
                      Today
                    </h1>
                    <p className={`m-0 mt-0.5 text-xs tabular-nums ${model.today.capacity.isOverCapacity ? "text-destructive" : "text-muted-foreground"}`}>
                      <span className="font-semibold text-foreground">
                        {model.today.capacity.isOverCapacity ? `${model.today.capacity.overageMinutes}m` : `${model.today.capacity.remainingMinutes}m`}
                      </span>{" "}
                      {model.today.capacity.isOverCapacity ? "over capacity" : "remaining"}
                    </p>
                  </div>
                  {model.today.unsizedTaskCount > 0 ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {model.today.unsizedTaskCount} unsized
                    </span>
                  ) : null}
                </div>
                <div
                  aria-label={`${model.today.capacity.committedMinutes} of ${planner.effectiveCapacityMinutes} minutes committed`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={capacityPercentage(model.today.capacity.committedMinutes, planner.effectiveCapacityMinutes)}
                  aria-valuetext={capacityStatus(model.today.capacity)}
                  className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                >
                  <span
                    className={`block h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${model.today.capacity.isOverCapacity ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${capacityPercentage(model.today.capacity.committedMinutes, planner.effectiveCapacityMinutes)}%` }}
                  />
                </div>
              </section>

              {model.today.active.tasks.length > 0 || model.today.completed.tasks.length > 0 ? (
                <TaskGroup
                  className="mt-2"
                  compact
                  completedTasks={model.today.completed.tasks}
                  hideLabel
                  label="Today tasks"
                  metadataForTask={todayMetadata}
                  onReorderTasks={model.hasQuery ? undefined : handleReorderToday}
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
                <EmptyWorkspaceMessage
                  actionLabel="Add a task"
                  description="Capture work above, then commit it to Today from its details."
                  icon={Sun01Icon}
                  onAction={() => document.getElementById("task-composer-input")?.focus()}
                  title="Your day is open"
                />
              )}

              <section aria-labelledby="daily-backlog-heading" className="mt-5 border-t border-border pt-3">
                <button
                  aria-controls="daily-backlog-list"
                  aria-expanded={backlogExpanded}
                  className="flex w-full items-center justify-between rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setBacklogExpanded((expanded) => !expanded)}
                  type="button"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="font-heading text-base font-semibold leading-5" id="daily-backlog-heading">Backlog</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{model.backlog.totalTaskCount}</span>
                  </span>
                  <span aria-hidden="true" className="text-xs text-muted-foreground">{backlogExpanded ? "⌃" : "⌄"}</span>
                </button>
                {backlogExpanded ? (
                  <div id="daily-backlog-list">
                    {model.backlog.active.tasks.length > 0 || model.backlog.completed.tasks.length > 0 ? (
                      <TaskGroup
                        className="mt-1"
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
                ) : null}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function capacityPercentage(committedMinutes: number, capacityMinutes: number) {
  return capacityMinutes > 0 ? Math.min((committedMinutes / capacityMinutes) * 100, 100) : 0;
}

function capacityStatus(capacity: ReturnType<typeof selectDailyWorkspace>["today"]["capacity"]) {
  return capacity.isOverCapacity ? `${capacity.overageMinutes} min over capacity` : `${capacity.remainingMinutes} min remaining`;
}

type EmptyWorkspaceMessageProps = {
  actionLabel: string;
  description: string;
  icon: typeof Sun01Icon;
  onAction: () => void;
  title: string;
};

function EmptyWorkspaceMessage({ actionLabel, description, icon, onAction, title }: EmptyWorkspaceMessageProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <HugeiconsIcon aria-hidden="true" className="text-muted-foreground" icon={icon} size={20} strokeWidth={1.8} />
      <p className="m-0 text-sm font-medium">{title}</p>
      <p className="m-0 max-w-[30ch] text-xs leading-4 text-muted-foreground">{description}</p>
      <Button className="mt-1 h-7 rounded-md px-2.5 text-xs" onClick={onAction} size="sm" type="button" variant="outline">
        {actionLabel}
      </Button>
    </div>
  );
}
