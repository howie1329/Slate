import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useTaskSelection } from "@/components/task-selection";
import { usePlannerState, useSetTaskCompleted } from "@/lib/planner-query";
import { calculateCapacityState, formatMinutes, orderTasks, scopeForTask } from "@/lib/task-groups";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  const planner = usePlannerState();
  const setTaskCompleted = useSetTaskCompleted();
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
  const capacityMinutes = settings.dailyCapacityMinutes;
  const capacity = calculateCapacityState(activeTasks, capacityMinutes);
  const { committedMinutes, remainingMinutes, overageMinutes, isOverCapacity, overflowTaskId } = capacity;
  const capacityPercentage = Math.min((committedMinutes / capacityMinutes) * 100, 100);
  const capacityStatus = isOverCapacity
    ? `${overageMinutes} min over capacity`
    : `${remainingMinutes} min remaining`;

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
        <div className="flex items-baseline justify-between gap-4">
          <p className="m-0 text-sm font-semibold leading-5 tabular-nums text-foreground">
            {capacityStatus}
          </p>
          <p className="m-0 text-menu-label font-semibold text-muted-foreground">
            committed
          </p>
        </div>
        <div
          aria-label={`${committedMinutes} of ${capacityMinutes} minutes committed`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={capacityPercentage}
          aria-valuetext={capacityStatus}
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <span
            className={`block h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${
              isOverCapacity ? "bg-destructive" : "bg-primary"
            }`}
            style={{ width: `${capacityPercentage}%` }}
          />
        </div>

        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <p className="mb-0 mt-6 text-sm text-muted-foreground">Nothing is planned for today.</p>
        ) : null}
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
      </div>
    </section>
  );
}
