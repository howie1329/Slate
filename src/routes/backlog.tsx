import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { InboxIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { PlannerEmptyState } from "@/components/planner-empty-state";
import { TaskGroup } from "@/components/task-group";
import { useTaskSelection } from "@/components/task-selection";
import { focusTaskComposer } from "@/lib/task-composer";
import { usePlannerState, useSetTaskCompleted } from "@/lib/planner-query";
import { orderTasks, scopeForTask } from "@/lib/task-groups";

export const Route = createFileRoute("/backlog")({
  component: BacklogPage,
});

function BacklogPage() {
  const planner = usePlannerState();
  const setTaskCompleted = useSetTaskCompleted();
  const { selectedTaskId, selectTask } = useTaskSelection();

  if (!planner.data) {
    return null;
  }

  const { tasks, today, orderByScope } = planner.data;
  const groups = [
    ["Needs estimate", "log:needs-estimate"],
    ["Unscheduled", "log:unscheduled"],
    ["Overdue / needs reschedule", "log:overdue"],
    ["Upcoming", "log:upcoming"],
  ] as const;
  const hasVisibleTasks = tasks.some(
    (task) => task.completedAt === null && scopeForTask(task, today) !== `today:${today}`,
  );

  function toggleTask(taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task.") },
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
        {!hasVisibleTasks ? (
          <PlannerEmptyState
            actionLabel="Add a task"
            description="Capture work here, then decide when it deserves space in your day."
            onAction={focusTaskComposer}
            title="Your backlog is clear."
          >
            <HugeiconsIcon icon={InboxIcon} strokeWidth={1.8} />
          </PlannerEmptyState>
        ) : (
          <>
            {groups.map(([label, scope]) => (
              <TaskGroup
                key={scope}
                label={label}
                onToggleTask={toggleTask}
                pending={setTaskCompleted.isPending}
                selectedTaskId={selectedTaskId}
                onSelectTask={selectTask}
                tasks={orderTasks(
                  tasks.filter((task) => scopeForTask(task, today) === scope),
                  orderByScope,
                  scope,
                )}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
