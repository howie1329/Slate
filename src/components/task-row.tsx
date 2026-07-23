import { useRef } from "react";
import { motion } from "motion/react";
import { Checkbox } from "@/components/ui/checkbox";
import type { TaskMutationMotion, TaskMotionTransition } from "@/components/task-motion";
import type { TaskSelectionTransition } from "@/components/task-selection";
import type { Task } from "@/lib/planner";
import { formatMinutes } from "@/lib/task-groups";
import { cn } from "@/lib/utils";

type TaskRowProps = {
  isOverflow?: boolean;
  isPending: boolean;
  isSelected: boolean;
  onSelectTask: (taskId: string, transition?: TaskSelectionTransition) => void;
  onMotionComplete: (version: number) => void;
  onToggleTask: (taskId: string, transition?: TaskMotionTransition) => void;
  shouldAnimateEnter: boolean;
  task: Task;
  taskMutation: TaskMutationMotion | null;
};

const taskRowEase = [0.23, 1, 0.32, 1] as const;
const taskLayoutEase = [0.77, 0, 0.175, 1] as const;

export function TaskRow({
  isOverflow = false,
  isPending,
  isSelected,
  onMotionComplete,
  onSelectTask,
  onToggleTask,
  shouldAnimateEnter,
  task,
  taskMutation,
}: TaskRowProps) {
  const isCompleted = task.completedAt !== null;
  const toggleTransitionRef = useRef<TaskMotionTransition>("instant");
  const canAnimateLayout = taskMutation?.transition === "animate";
  const rowVariants = {
    hidden: {
      opacity: 0,
      transform: "translateY(8px)",
    },
    visible: {
      opacity: 1,
      transform: "translateY(0)",
      transition: {
        duration: 0.18,
        ease: taskRowEase,
      },
    },
    exit: (mutation: TaskMutationMotion | null) =>
      mutation?.transition === "animate" && mutation.taskId === task.id
        ? {
            opacity: 0,
            transform: "translateY(-6px)",
            transition: {
              duration: 0.16,
              ease: taskRowEase,
            },
          }
        : {
            opacity: 0,
            transition: { duration: 0 },
          },
  };

  return (
    <motion.li
      animate="visible"
      className="relative"
      data-task-row
      exit="exit"
      initial={shouldAnimateEnter ? "hidden" : false}
      layout={canAnimateLayout ? "position" : false}
      onLayoutAnimationComplete={() => {
        if (taskMutation) {
          onMotionComplete(taskMutation.version);
        }
      }}
      transition={{ layout: { duration: 0.2, ease: taskLayoutEase } }}
    >
      <motion.div
        className={cn(
          "group/task-row flex min-h-11 items-center gap-2 transition-colors duration-150 hover:bg-muted motion-reduce:transition-none",
          isSelected && "bg-muted",
          isOverflow && "ring-1 ring-inset ring-destructive",
        )}
        custom={taskMutation}
        onAnimationComplete={(definition) => {
          if (definition === "visible" && shouldAnimateEnter && taskMutation) {
            onMotionComplete(taskMutation.version);
          }
        }}
        variants={rowVariants}
      >
        <Checkbox
          aria-label={`Mark ${task.title} as ${isCompleted ? "incomplete" : "complete"}`}
          checked={isCompleted}
          className="ml-1 size-5 rounded-full after:-inset-3"
          disabled={isPending}
          onCheckedChange={() => onToggleTask(task.id, toggleTransitionRef.current)}
          onKeyDownCapture={() => {
            toggleTransitionRef.current = "instant";
          }}
          onPointerDownCapture={() => {
            toggleTransitionRef.current = "animate";
          }}
        />
        <button
          aria-expanded={isSelected}
          aria-label={`Edit ${task.title}${isOverflow ? ", pushes today over capacity" : ""}`}
          className="flex min-w-0 flex-1 self-stretch items-center gap-3 rounded-md pl-1 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={(event) => onSelectTask(task.id, event.detail > 0 ? "animate" : "instant")}
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
      </motion.div>
    </motion.li>
  );
}
