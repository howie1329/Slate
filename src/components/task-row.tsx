import { useRef, type CSSProperties } from "react";
import { BookmarkCheck01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { Checkbox } from "@/components/ui/checkbox";
import type { TaskMutationMotion, TaskMotionTransition } from "@/components/task-motion";
import type { TaskSelectionTransition } from "@/components/task-selection";
import type { DailyTaskMetadata } from "@/lib/daily-workspace";
import type { Task } from "@/lib/planner";
import { formatMinutes } from "@/lib/task-groups";
import { cn } from "@/lib/utils";

export type TaskRowProps = {
  compact?: boolean;
  isOverflow?: boolean;
  isPending: boolean;
  isSelected: boolean;
  metadata?: DailyTaskMetadata[];
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
  compact = false,
  isOverflow = false,
  isPending,
  isSelected,
  metadata = [],
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
            "group/task-row flex items-center transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none",
            compact ? "min-h-9" : "min-h-12",
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
            aria-controls={isSelected ? "task-detail-panel" : undefined}
            aria-expanded={isSelected}
            aria-label={`Edit ${task.title}${isOverflow ? ", pushes today over capacity" : ""}`}
            className={cn(
              "flex min-w-0 flex-1 self-stretch items-center gap-3 rounded-md pl-3 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              compact ? "py-1" : "py-1.5",
            )}
            onClick={(event) => onSelectTask(task.id, event.detail > 0 ? "animate" : "instant")}
            type="button"
          >
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-menu font-medium leading-4",
                  isCompleted
                    ? cn("font-normal line-through", isSelected ? "text-foreground/70" : "text-muted-foreground")
                    : cn("text-foreground", isSelected && "font-semibold"),
                )}
              >
                {task.title}
              </span>
              {metadata.length > 0 ? (
                <span className="mt-0.5 flex min-w-0 gap-1.5 truncate text-metadata text-muted-foreground">
                  {metadata.map((item) => (
                    <span
                      className={cn(item.tone === "destructive" && "text-destructive", item.tone === "caution" && "text-capacity-caution")}
                      key={item.label}
                    >
                      {item.label}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "w-14 shrink-0 text-right text-xs leading-4 tabular-nums",
                isSelected ? "text-foreground/70" : "text-muted-foreground",
              )}
            >
              {formatMinutes(task.estimateMinutes)}
            </span>
            {task.completedAt === null && task.anchorDate !== null ? (
              <span aria-label="Anchored for today" className="shrink-0 text-primary" title="Anchored for today">
                <HugeiconsIcon aria-hidden="true" icon={BookmarkCheck01Icon} size={15} strokeWidth={1.7} />
              </span>
            ) : null}
          </button>
          {sortable?.showDragHandle ? (
            <button
              {...sortable.attributes}
              {...sortable.listeners}
              aria-label={`Reorder ${task.title}, position ${sortable.position} of ${sortable.itemCount}`}
              className={cn(
                "mr-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground opacity-25 outline-none transition-[color,background-color,opacity] duration-150 group-hover/task-row:opacity-70 hover:bg-background hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing motion-reduce:transition-none",
                sortable.disabled && "cursor-default opacity-20 group-hover/task-row:opacity-35",
              )}
              ref={sortable.setActivatorNodeRef}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" icon={DragDropVerticalIcon} size={16} strokeWidth={1.8} />
            </button>
          ) : null}
        </motion.div>
      </motion.div>
    </li>
  );
}
