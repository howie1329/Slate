import { useRef, type CSSProperties } from "react";
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

type SortableTaskRowProps = TaskRowProps & {
  disabled: boolean;
  itemCount: number;
  position: number;
  showDragHandle: boolean;
};

type SortableState = Pick<
  ReturnType<typeof useSortable>,
  | "attributes"
  | "isDragging"
  | "listeners"
  | "setActivatorNodeRef"
  | "setNodeRef"
  | "transform"
  | "transition"
> & {
  disabled: boolean;
  itemCount: number;
  position: number;
  showDragHandle: boolean;
};

const taskRowEase = [0.23, 1, 0.32, 1] as const;
const taskLayoutEase = [0.77, 0, 0.175, 1] as const;

export function TaskRow(props: TaskRowProps) {
  return <TaskRowContent {...props} />;
}

export function SortableTaskRow({
  disabled,
  itemCount,
  position,
  showDragHandle,
  task,
  ...props
}: SortableTaskRowProps) {
  const sortable = useSortable({
    id: task.id,
    disabled,
  });

  return (
    <TaskRowContent
      {...props}
      sortable={{
        attributes: sortable.attributes,
        disabled,
        isDragging: sortable.isDragging,
        itemCount,
        listeners: sortable.listeners,
        position,
        setActivatorNodeRef: sortable.setActivatorNodeRef,
        setNodeRef: sortable.setNodeRef,
        showDragHandle,
        transform: sortable.transform,
        transition: sortable.transition,
      }}
      task={task}
    />
  );
}

function TaskRowContent({
  isOverflow = false,
  isPending,
  isSelected,
  onMotionComplete,
  onSelectTask,
  onToggleTask,
  shouldAnimateEnter,
  task,
  taskMutation,
  sortable,
}: TaskRowProps & { sortable?: SortableState }) {
  const isCompleted = task.completedAt !== null;
  const toggleTransitionRef = useRef<TaskMotionTransition>("instant");
  const canAnimateLayout = taskMutation?.transition === "animate";
  const sortableStyle: CSSProperties | undefined = sortable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;
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
    <li
      className={cn("relative", sortable?.isDragging && "z-10")}
      data-task-row
      ref={sortable?.setNodeRef}
      style={sortableStyle}
    >
      <motion.div
        layout={canAnimateLayout ? "position" : false}
        onLayoutAnimationComplete={() => {
          if (taskMutation) {
            onMotionComplete(taskMutation.version);
          }
        }}
        transition={{ layout: { duration: 0.2, ease: taskLayoutEase } }}
      >
        <motion.div
          animate="visible"
          className={cn(
            "group/task-row flex min-h-11 items-center gap-2 transition-colors duration-150 hover:bg-muted motion-reduce:transition-none",
            isSelected && "bg-muted",
            isOverflow && "ring-1 ring-inset ring-destructive",
            sortable?.isDragging && "bg-muted ring-1 ring-inset ring-ring",
          )}
          custom={taskMutation}
          exit="exit"
          initial={shouldAnimateEnter ? "hidden" : false}
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
          {sortable?.showDragHandle ? (
            <button
              {...sortable.attributes}
              {...sortable.listeners}
              aria-label={`Reorder ${task.title}, position ${sortable.position} of ${sortable.itemCount}`}
              className={cn(
                "mr-0.5 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground opacity-50 outline-none transition-[color,background-color,opacity] duration-150 hover:bg-background hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing motion-reduce:transition-none",
                sortable.disabled && "cursor-default opacity-35",
              )}
              ref={sortable.setActivatorNodeRef}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" icon={DragDropVerticalIcon} size={16} strokeWidth={1.8} />
            </button>
          ) : (
            <span aria-hidden="true" className="mr-0.5 size-8 shrink-0" />
          )}
        </motion.div>
      </motion.div>
    </li>
  );
}
