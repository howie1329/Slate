import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { configuredMockSettings } from "@/mock-data/settings";
import { mockTasks, mockToday } from "@/mock-data/tasks";

const todayTasks = mockTasks
  .filter((task) => task.scheduledDate === mockToday)
  .sort((first, second) => first.sortOrder - second.sortOrder);

const initiallyCompletedTaskIds = new Set(
  todayTasks.filter((task) => task.completedAt !== null).map((task) => task.id),
);

function formatMinutes(minutes: number | null) {
  return minutes === null ? "—" : `${minutes} min`;
}

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  const [completedTaskIds, setCompletedTaskIds] = useState(initiallyCompletedTaskIds);
  const capacityMinutes = configuredMockSettings.settings.dailyCapacityMinutes;
  const committedMinutes = todayTasks.reduce(
    (total, task) => total + (task.estimateMinutes ?? 0), 0,
  );
  const capacityPercentage = Math.min((committedMinutes / capacityMinutes) * 100, 100);

  function toggleTask(taskId: string) {
    setCompletedTaskIds((currentTaskIds) => {
      const nextTaskIds = new Set(currentTaskIds);

      if (nextTaskIds.has(taskId)) {
        nextTaskIds.delete(taskId);
      } else {
        nextTaskIds.add(taskId);
      }

      return nextTaskIds;
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-24 pt-5 sm:px-6 sm:pt-6" aria-label="Today tasks">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <p className="m-0 text-base font-semibold leading-6 tabular-nums text-foreground">
            {committedMinutes} / {capacityMinutes} min
          </p>
          <p className="m-0 text-xs font-semibold leading-tight text-muted-foreground">
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

        <ul className="m-0 mt-6 list-none divide-y divide-border p-0">
          {todayTasks.map((task) => {
            const isCompleted = completedTaskIds.has(task.id);

            return (
              <li key={task.id} className="flex min-h-14 items-center gap-3 py-1">
                <Checkbox
                  aria-label={`Mark ${task.title} as ${isCompleted ? "incomplete" : "complete"}`}
                  checked={isCompleted}
                  className="size-5 rounded-full after:-inset-3"
                  onCheckedChange={() => toggleTask(task.id)}
                />
                <p
                  className={`m-0 min-w-0 flex-1 truncate text-sm leading-5 ${
                    isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {task.title}
                </p>
                <span
                  className={`shrink-0 text-sm leading-none tabular-nums ${
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
