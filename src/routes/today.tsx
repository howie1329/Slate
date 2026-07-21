import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlannerState, useSetTaskCompleted } from "@/lib/planner-query";
import { formatMinutes, orderTasks } from "@/lib/task-groups";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  const planner = usePlannerState();
  const setTaskCompleted = useSetTaskCompleted();

  if (!planner.data) {
    return null;
  }

  const { settings, tasks, today, orderByScope } = planner.data;
  const scheduledToday = tasks.filter((task) => task.scheduledDate === today);
  const activeTasks = orderTasks(
    scheduledToday.filter((task) => task.completedAt === null),
    orderByScope,
    `today:${today}`,
  );
  const completedTasks = scheduledToday
    .filter((task) => task.completedAt !== null)
    .sort((first, second) => (first.completedAt ?? "").localeCompare(second.completedAt ?? ""));
  const capacityMinutes = settings.dailyCapacityMinutes;
  const committedMinutes = activeTasks.reduce(
    (total, task) => total + (task.estimateMinutes ?? 0), 0,
  );
  const capacityPercentage = Math.min((committedMinutes / capacityMinutes) * 100, 100);

  function toggleTask(taskId: string) {
    const task = scheduledToday.find((candidate) => candidate.id === taskId);
    if (!task) return;
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task.") },
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-24 pt-5 sm:px-6 sm:pt-6" aria-label="Today tasks">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <p className="m-0 text-sm font-semibold leading-5 tabular-nums text-foreground">
            {committedMinutes} / {capacityMinutes} min
          </p>
          <p className="m-0 text-menu-label font-semibold text-muted-foreground">
            committed
          </p>
        </div>
        <div
          aria-label={`${committedMinutes} of ${capacityMinutes} minutes committed`}
          aria-valuemax={capacityMinutes}
          aria-valuemin={0}
          aria-valuenow={committedMinutes}
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${capacityPercentage}%` }}
          />
        </div>

        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <p className="mb-0 mt-6 text-sm text-muted-foreground">Nothing is planned for today.</p>
        ) : null}
        <ul className="m-0 mt-6 list-none divide-y divide-border p-0">
          {[...activeTasks, ...completedTasks].map((task) => {
            const isCompleted = task.completedAt !== null;

            return (
              <li key={task.id} className="flex min-h-14 items-center gap-3 py-1">
                <Checkbox
                  aria-label={`Mark ${task.title} as ${isCompleted ? "incomplete" : "complete"}`}
                  checked={isCompleted}
                  className="size-5 rounded-full after:-inset-3"
                  disabled={setTaskCompleted.isPending}
                  onCheckedChange={() => toggleTask(task.id)}
                />
                <p
                  className={`m-0 min-w-0 flex-1 truncate text-menu ${
                    isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {task.title}
                </p>
                <span
                  className={`shrink-0 text-xs leading-none tabular-nums ${
                    isCompleted ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {formatMinutes(task.estimateMinutes)}
                </span>
                <button
                  aria-label={`Task options for ${task.title}`}
                  className="grid size-10 shrink-0 place-items-center rounded-md text-xl leading-none text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-100 motion-reduce:transition-none"
                  disabled
                  title="Task actions are not available yet"
                  type="button"
                >
                  <span aria-hidden="true" className="block -translate-y-px">
                    ⋯
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
