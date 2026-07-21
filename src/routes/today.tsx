import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { PlannerEmptyState } from "@/components/planner-empty-state";
import { useTaskSelection } from "@/components/task-selection";
import { focusTaskComposer } from "@/lib/task-composer";
import { usePlannerState, useSetTaskCompleted } from "@/lib/planner-query";
import { calculateCapacityState, formatMinutes, orderTasks, scopeForTask } from "@/lib/task-groups";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  const planner = usePlannerState();
  const setTaskCompleted = useSetTaskCompleted();
  const navigate = useNavigate();
  const { selectedTaskId, selectTask } = useTaskSelection();

  if (!planner.data) {
    return null;
  }

  const { settings, tasks, today, orderByScope } = planner.data;
  const scheduledToday = tasks.filter((task) => task.scheduledDate === today);
  const todayScope = `today:${today}`;
  const activeTasks = orderTasks(
    tasks.filter((task) => scopeForTask(task, today) === todayScope),
    orderByScope,
    todayScope,
  );
  const completedTasks = scheduledToday
    .filter((task) => task.completedAt !== null)
    .sort((first, second) => (first.completedAt ?? "").localeCompare(second.completedAt ?? ""));
  const hasBacklogTasks = tasks.some(
    (task) => task.completedAt === null && scopeForTask(task, today) !== todayScope,
  );
  const capacityMinutes = settings.dailyCapacityMinutes;
  const capacity = calculateCapacityState(activeTasks, capacityMinutes);
  const { overflowTaskId } = capacity;

  function toggleTask(taskId: string) {
    const task = scheduledToday.find((candidate) => candidate.id === taskId);
    if (!task) return;
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task.") },
    );
  }

  return (
    <section className={`flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6 ${selectedTaskId ? "pb-48" : "pb-24"}`} aria-label="Today tasks">
      <div className="mx-auto w-full max-w-xl">
        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <PlannerEmptyState
            actionLabel={hasBacklogTasks ? "Browse backlog" : "Add a task"}
            description={
              hasBacklogTasks
                ? "Choose what deserves space before you make a commitment."
                : "Add one task below to make your first commitment."
            }
            onAction={() => {
              if (hasBacklogTasks) {
                void navigate({ to: "/backlog" });
                return;
              }

              focusTaskComposer();
            }}
            title="Your day is open."
          >
            <HugeiconsIcon icon={Sun01Icon} strokeWidth={1.8} />
          </PlannerEmptyState>
        ) : (
          <ul className="m-0 mt-6 list-none divide-y divide-border p-0">
            {[...activeTasks, ...completedTasks].map((task) => {
              const isCompleted = task.completedAt !== null;
              const isOverflowTask = !isCompleted && task.id === overflowTaskId;

              return (
                <li key={task.id} className="flex min-h-14 items-center gap-3 py-1" data-task-row>
                  <Checkbox
                    aria-label={`Mark ${task.title} as ${isCompleted ? "incomplete" : "complete"}`}
                    checked={isCompleted}
                    className="size-5 rounded-full after:-inset-3"
                    disabled={setTaskCompleted.isPending}
                    onCheckedChange={() => toggleTask(task.id)}
                  />
                  <button
                    aria-expanded={selectedTaskId === task.id}
                    aria-label={`Edit ${task.title}${isOverflowTask ? ", pushes today over capacity" : ""}`}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-md py-2 text-left outline-none transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${
                      isOverflowTask ? "border border-destructive px-[5px]" : "px-1.5"
                    } ${
                      selectedTaskId === task.id ? "bg-muted" : ""
                    }`}
                    onClick={() => selectTask(task.id)}
                    type="button"
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-menu ${
                        isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </span>
                    <span
                      className={`shrink-0 text-xs leading-none tabular-nums ${
                        isCompleted ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {formatMinutes(task.estimateMinutes)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
