import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { mockTasks, mockToday } from "@/mock-data/tasks";
import type { LocalDate } from "@/mock-data/types";

const backlogTasks = mockTasks.filter(
  (task) => task.scheduledDate === null || task.scheduledDate > mockToday,
);

const unscheduledTasks = backlogTasks
  .filter((task) => task.scheduledDate === null)
  .sort((first, second) => first.sortOrder - second.sortOrder);

const futureDates = [...new Set(
  backlogTasks.flatMap((task) => (task.scheduledDate === null ? [] : [task.scheduledDate])),
)] as LocalDate[];

const futureTaskGroups = futureDates
  .sort()
  .map((scheduledDate) => ({
    scheduledDate,
    tasks: backlogTasks
      .filter((task) => task.scheduledDate === scheduledDate)
      .sort((first, second) => first.sortOrder - second.sortOrder),
  }));

const initiallyCompletedTaskIds = new Set(
  backlogTasks.filter((task) => task.completedAt !== null).map((task) => task.id),
);

function formatMinutes(minutes: number | null) {
  return minutes === null ? "—" : `${minutes} min`;
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00`));
}

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const [completedTaskIds, setCompletedTaskIds] = useState(initiallyCompletedTaskIds);

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
    <section
      aria-labelledby="backlog-heading"
      className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-24 pt-5 sm:px-6 sm:pt-6"
    >
      <div className="mx-auto w-full max-w-xl">
        <h1 id="backlog-heading" className="sr-only">
          Backlog
        </h1>
        <p className="m-0 text-sm font-semibold leading-5 tabular-nums text-foreground">
          {backlogTasks.length} tasks
        </p>

        <TaskGroup
          completedTaskIds={completedTaskIds}
          label="Unscheduled"
          onToggleTask={toggleTask}
          tasks={unscheduledTasks}
        />

        {futureTaskGroups.map((group) => (
          <TaskGroup
            key={group.scheduledDate}
            completedTaskIds={completedTaskIds}
            label={formatDateLabel(group.scheduledDate)}
            onToggleTask={toggleTask}
            tasks={group.tasks}
          />
        ))}
      </div>
    </section>
  );
}

type TaskGroupProps = {
  completedTaskIds: Set<string>;
  label: string;
  onToggleTask: (taskId: string) => void;
  tasks: typeof mockTasks;
};

function TaskGroup({ completedTaskIds, label, onToggleTask, tasks }: TaskGroupProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="mt-5" aria-label={label}>
      <h2 className="m-0 border-b border-border pb-2 text-menu-label font-medium text-muted-foreground">
        {label}
      </h2>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {tasks.map((task) => {
          const isCompleted = completedTaskIds.has(task.id);

          return (
            <li key={task.id} className="flex min-h-14 items-center gap-3 py-1">
              <Checkbox
                aria-label={`Mark ${task.title} as ${isCompleted ? "incomplete" : "complete"}`}
                checked={isCompleted}
                className="size-5 rounded-full after:-inset-3"
                onCheckedChange={() => onToggleTask(task.id)}
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
    </section>
  );
}
