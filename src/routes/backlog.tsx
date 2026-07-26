import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { InboxIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { PlannerEmptyState } from "@/components/planner-empty-state";
import { TaskGroup } from "@/components/task-group";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { focusTaskComposer } from "@/lib/task-composer";
import type { PlannerSnapshot } from "@/lib/planner";
import { usePlannerState, useReorderTasks, useSetTaskCompleted } from "@/lib/planner-query";
import { orderCompletedTasks, orderTasks, scopeForTask } from "@/lib/task-groups";

export const Route = createFileRoute("/backlog")({
  component: BacklogPage,
});

function BacklogPage() {
  const planner = usePlannerState();

  if (!planner.data) {
    return null;
  }

  return <BacklogWorkspace planner={planner.data} />;
}

function BacklogWorkspace({ planner }: { planner: PlannerSnapshot }) {
  const setTaskCompleted = useSetTaskCompleted();
  const reorderTasks = useReorderTasks();
  const { recordTaskMutation, taskMutation } = useTaskMotion();
  const { selectedTaskId, selectTask } = useTaskSelection();
  const { tasks, today, orderByScope } = planner;
  const groups = [
    ["Needs estimate", "log:needs-estimate"],
    ["Unscheduled", "log:unscheduled"],
    ["Overdue / needs reschedule", "log:overdue"],
    ["Upcoming", "log:upcoming"],
    ["Completed", "log:completed"],
  ] as const;
  const hasVisibleTasks = tasks.some((task) => scopeForTask(task, today) !== `today:${today}`);
  const mutationPending = reorderTasks.isPending || setTaskCompleted.isPending;
  const [showEmptyState, setShowEmptyState] = useState(!hasVisibleTasks);

  useEffect(() => {
    if (hasVisibleTasks) {
      setShowEmptyState(false);
    }
  }, [hasVisibleTasks]);

  function toggleTask(taskId: string, transition: TaskMotionTransition = "instant") {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    recordTaskMutation({
      kind: task.completedAt === null ? "complete" : "restore",
      taskId,
      transition,
    });
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task.") },
    );
  }

  function handleTasksExitComplete() {
    if (!hasVisibleTasks) {
      setShowEmptyState(true);
    }
  }

  function handleReorderTasks(scope: string, taskIds: string[]) {
    reorderTasks.mutate(
      { scope, taskIds },
      { onError: () => toast.error("Could not save task order.") },
    );
  }

  return (
    <section
      aria-labelledby="backlog-heading"
      className={`flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6 ${selectedTaskId ? "pb-48" : "pb-24"}`}
    >
      <div className="mx-auto w-full max-w-xl">
        <h1 id="backlog-heading" className="sr-only">
          Backlog
        </h1>
        {showEmptyState && !hasVisibleTasks ? (
          <PlannerEmptyState
            actionLabel="Add a task"
            description="Capture work here, then decide when it deserves space in your day."
            onAction={focusTaskComposer}
            title="Your backlog is clear."
            transition={taskMutation?.transition ?? "instant"}
          >
            <HugeiconsIcon icon={InboxIcon} strokeWidth={1.8} />
          </PlannerEmptyState>
        ) : null}
        {groups.map(([label, scope]) => {
          const groupTasks =
            scope === "log:completed"
              ? orderCompletedTasks(tasks.filter((task) => scopeForTask(task, today) === scope))
              : orderTasks(
                  tasks.filter((task) => scopeForTask(task, today) === scope),
                  orderByScope,
                  scope,
                );

          return (
            <TaskGroup
              key={scope}
              label={label}
              onReorderTasks={
                scope === "log:completed"
                  ? undefined
                  : (taskIds) => handleReorderTasks(scope, taskIds)
              }
              onSelectTask={selectTask}
              onTasksExitComplete={handleTasksExitComplete}
              onToggleTask={toggleTask}
              pending={mutationPending}
              reorderDisabled={mutationPending}
              selectedTaskId={selectedTaskId}
              taskMutation={taskMutation}
              tasks={groupTasks}
            />
          );
        })}
      </div>
    </section>
  );
}
