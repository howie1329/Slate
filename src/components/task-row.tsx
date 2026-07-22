import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/planner";
import { formatMinutes } from "@/lib/task-groups";
import { cn } from "@/lib/utils";

type TaskRowProps = {
  isOverflow?: boolean;
  isPending: boolean;
  isSelected: boolean;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  task: Task;
};

export function TaskRow({
  isOverflow = false,
  isPending,
  isSelected,
  onSelectTask,
  onToggleTask,
  task,
}: TaskRowProps) {
  const isCompleted = task.completedAt !== null;

  return (
    <li
      className={cn(
        "group/task-row relative flex min-h-11 items-center gap-2 transition-colors duration-150 hover:bg-muted motion-reduce:transition-none",
        isSelected && "bg-muted",
        isOverflow && "ring-1 ring-inset ring-destructive",
      )}
      data-task-row
    >
      <Checkbox
        aria-label={`Mark ${task.title} as ${isCompleted ? "incomplete" : "complete"}`}
        checked={isCompleted}
        className="ml-1 size-5 rounded-full after:-inset-3"
        disabled={isPending}
        onCheckedChange={() => onToggleTask(task.id)}
      />
      <button
        aria-expanded={isSelected}
        aria-label={`Edit ${task.title}${isOverflow ? ", pushes today over capacity" : ""}`}
        className="flex min-w-0 flex-1 self-stretch items-center gap-3 rounded-md pl-1 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => onSelectTask(task.id)}
        type="button"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-menu",
            isCompleted ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        <span className="shrink-0 text-xs leading-4 tabular-nums text-muted-foreground">
          {formatMinutes(task.estimateMinutes)}
        </span>
      </button>
    </li>
  );
}
