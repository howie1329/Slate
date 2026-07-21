import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useTaskSelection } from "@/components/task-selection";
import { usePlannerState, useSetTaskCompleted } from "@/lib/planner-query";
import { formatMinutes, orderTasks, scopeForTask } from "@/lib/task-groups";
import type { Task } from "@/lib/planner";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

function InboxPage() {
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
  const completedTasks = tasks.filter((task) => task.completedAt !== null);

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
        <p className="m-0 text-sm font-semibold leading-5 tabular-nums text-foreground">
          {tasks.filter((task) => task.completedAt === null).length} tasks
        </p>

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
        <TaskGroup
          label="Completed"
          onToggleTask={toggleTask}
          pending={setTaskCompleted.isPending}
          selectedTaskId={selectedTaskId}
          onSelectTask={selectTask}
          tasks={completedTasks}
        />
      </div>
    </section>
  );
}

type TaskGroupProps = {
  label: string;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  pending: boolean;
  selectedTaskId: string | null;
  tasks: Task[];
};

function TaskGroup({ label, onSelectTask, onToggleTask, pending, selectedTaskId, tasks }: TaskGroupProps) {
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
          const isCompleted = task.completedAt !== null;

          return (
            <li key={task.id} className="flex min-h-14 items-center gap-3 py-1" data-task-row>
              <Checkbox
                aria-label={`Mark ${task.title} as ${isCompleted ? "incomplete" : "complete"}`}
                checked={isCompleted}
                className="size-5 rounded-full after:-inset-3"
              disabled={pending}
              onCheckedChange={() => onToggleTask(task.id)}
              />
              <button
                aria-expanded={selectedTaskId === task.id}
                aria-label={`Edit ${task.title}`}
                className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-1.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${
                  selectedTaskId === task.id ? "bg-muted" : ""
                }`}
                onClick={() => onSelectTask(task.id)}
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
    </section>
  );
}
