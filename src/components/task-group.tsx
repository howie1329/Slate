import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { TaskMutationMotion, TaskMotionTransition } from "@/components/task-motion";
import { TaskRow } from "@/components/task-row";
import type { TaskSelectionTransition } from "@/components/task-selection";
import type { Task } from "@/lib/planner";
import { cn } from "@/lib/utils";

type TaskGroupProps = {
  className?: string;
  label: string;
  onSelectTask: (taskId: string, transition?: TaskSelectionTransition) => void;
  onTasksExitComplete?: () => void;
  onToggleTask: (taskId: string, transition?: TaskMotionTransition) => void;
  overflowTaskId?: string | null;
  pending: boolean;
  selectedTaskId: string | null;
  taskMutation?: TaskMutationMotion | null;
  tasks: Task[];
};

export function TaskGroup({
  className,
  label,
  onSelectTask,
  onTasksExitComplete,
  onToggleTask,
  overflowTaskId = null,
  pending,
  selectedTaskId,
  taskMutation = null,
  tasks,
}: TaskGroupProps) {
  const [hasRenderedTasks, setHasRenderedTasks] = useState(tasks.length > 0);
  const previousTaskIdsRef = useRef(new Set(tasks.map((task) => task.id)));
  const handledMotionVersionRef = useRef<number | null>(null);
  const previousTaskIds = previousTaskIdsRef.current;
  const canAnimateEntry =
    taskMutation?.transition === "animate" && handledMotionVersionRef.current !== taskMutation.version;
  const addedTasks = tasks.filter((task) => !previousTaskIds.has(task.id));
  const enteringTaskId = canAnimateEntry
    ? taskMutation?.kind === "create"
      ? addedTasks[0]?.id ?? null
      : addedTasks.some((task) => task.id === taskMutation?.taskId)
        ? taskMutation?.taskId ?? null
        : null
    : null;

  useEffect(() => {
    previousTaskIdsRef.current = new Set(tasks.map((task) => task.id));
    if (enteringTaskId && taskMutation) {
      handledMotionVersionRef.current = taskMutation.version;
    }
    if (tasks.length > 0) {
      setHasRenderedTasks(true);
    }
  }, [enteringTaskId, taskMutation, tasks]);

  if (tasks.length === 0 && !hasRenderedTasks) {
    return null;
  }

  return (
    <section aria-label={label} className={cn("mt-5", className)}>
      <h2 className="m-0 border-b border-border pb-2 text-menu-label font-medium text-muted-foreground">
        {label}
      </h2>
      <ul className="m-0 list-none divide-y divide-border p-0">
        <AnimatePresence
          custom={taskMutation}
          initial={false}
          onExitComplete={() => {
            if (tasks.length === 0) {
              setHasRenderedTasks(false);
              onTasksExitComplete?.();
            }
          }}
        >
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              isOverflow={task.id === overflowTaskId && task.completedAt === null}
              isPending={pending}
              isSelected={selectedTaskId === task.id}
              onSelectTask={onSelectTask}
              onToggleTask={onToggleTask}
              shouldAnimateEnter={task.id === enteringTaskId}
              task={task}
              taskMutation={taskMutation}
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
