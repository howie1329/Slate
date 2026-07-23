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
import { usePlannerState, useSetTaskCompleted } from "@/lib/planner-query";
import { orderTasks, scopeForTask } from "@/lib/task-groups";

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
  const { recordTaskMutation, taskMutation } = useTaskMotion();
  const { selectedTaskId, selectTask } = useTaskSelection();
  const { tasks, today, orderByScope } = planner;
  const groups = [
    ["Needs estimate", "log:needs-estimate"],
    ["Unscheduled", "log:unscheduled"],
    ["Overdue / needs reschedule", "log:overdue"],
    ["Upcoming", "log:upcoming"],
  ] as const;
  const hasVisibleTasks = tasks.some(
    (task) => task.completedAt === null && scopeForTask(task, today) !== `today:${today}`,
  );
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
        {groups.map(([label, scope]) => (
          <TaskGroup
            key={scope}
            label={label}
            onTasksExitComplete={handleTasksExitComplete}
            onToggleTask={toggleTask}
            pending={setTaskCompleted.isPending}
            selectedTaskId={selectedTaskId}
            onSelectTask={selectTask}
            taskMutation={taskMutation}
            tasks={orderTasks(
              tasks.filter((task) => scopeForTask(task, today) === scope),
              orderByScope,
              scope,
            )}
          />
        ))}
      </div>
    </section>
  );
}
