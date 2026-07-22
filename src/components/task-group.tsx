import { TaskRow } from "@/components/task-row";
import type { Task } from "@/lib/planner";
import { cn } from "@/lib/utils";

type TaskGroupProps = {
  className?: string;
  label: string;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  overflowTaskId?: string | null;
  pending: boolean;
  selectedTaskId: string | null;
  tasks: Task[];
};

export function TaskGroup({
  className,
  label,
  onSelectTask,
  onToggleTask,
  overflowTaskId = null,
  pending,
  selectedTaskId,
  tasks,
}: TaskGroupProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section aria-label={label} className={cn("mt-5", className)}>
      <h2 className="m-0 border-b border-border pb-2 text-menu-label font-medium text-muted-foreground">
        {label}
      </h2>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            isOverflow={task.id === overflowTaskId && task.completedAt === null}
            isPending={pending}
            isSelected={selectedTaskId === task.id}
            onSelectTask={onSelectTask}
            onToggleTask={onToggleTask}
            task={task}
          />
        ))}
      </ul>
    </section>
  );
}
