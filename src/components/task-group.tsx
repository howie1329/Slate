import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";
import { useTaskMotion, type TaskMutationMotion, type TaskMotionTransition } from "@/components/task-motion";
import { SortableTaskRow, TaskRow } from "@/components/task-row";
import type { TaskSelectionFocus, TaskSelectionTransition } from "@/components/task-selection";
import type { Task } from "@/lib/planner";
import { cn } from "@/lib/utils";

type TaskGroupProps = {
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  dragTargetId?: string;
  draggable?: boolean;
  emphasized?: boolean;
  emptyMessage?: string;
  forceExpanded?: boolean;
  getTaskMetadata?: (task: Task) => string | null;
  getTaskOrderDetails?: (task: Task) => TaskOrderDetails | undefined;
  isDragTarget?: boolean;
  label: string;
  onSelectTask: (taskId: string, transition?: TaskSelectionTransition, focus?: TaskSelectionFocus) => void;
  onTasksExitComplete?: () => void;
  onToggleTask: (taskId: string, transition?: TaskMotionTransition) => void;
  overflowTaskId?: string | null;
  pending: boolean;
  reorderDisabled?: boolean;
  selectedTaskId: string | null;
  taskMutation?: TaskMutationMotion | null;
  tasks: Task[];
};

export type TaskOrderDetails = {
  itemCount: number;
  position: number;
  sectionLabel: string;
};

export function TaskGroup({
  className,
  collapsible = false,
  defaultCollapsed = false,
  dragTargetId,
  draggable = false,
  emphasized = false,
  emptyMessage,
  forceExpanded = false,
  getTaskMetadata,
  getTaskOrderDetails,
  isDragTarget = false,
  label,
  onSelectTask,
  onTasksExitComplete,
  onToggleTask,
  overflowTaskId = null,
  pending,
  reorderDisabled = false,
  selectedTaskId,
  taskMutation = null,
  tasks,
}: TaskGroupProps) {
  const { clearTaskMutation } = useTaskMotion();
  const contentId = useId();
  const [hasRenderedTasks, setHasRenderedTasks] = useState(tasks.length > 0);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(defaultCollapsed);
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
  const isCollapsed = collapsible && isManuallyCollapsed && !enteringTaskId && !forceExpanded;
  const taskIds = tasks.map((task) => task.id);

  useEffect(() => {
    previousTaskIdsRef.current = new Set(tasks.map((task) => task.id));
    if (enteringTaskId && taskMutation) {
      handledMotionVersionRef.current = taskMutation.version;
    }
    if (tasks.length > 0) {
      setHasRenderedTasks(true);
    }
  }, [enteringTaskId, taskMutation, tasks]);

  useEffect(() => {
    if (collapsible && enteringTaskId) {
      setIsManuallyCollapsed(false);
    }
  }, [collapsible, enteringTaskId]);

  if (tasks.length === 0 && !hasRenderedTasks && !emptyMessage && !dragTargetId) {
    return null;
  }

  const rows = (
    <AnimatePresence
      custom={taskMutation}
      initial={false}
      onExitComplete={() => {
        if (taskMutation) {
          const completedVersion = taskMutation.version;
          window.setTimeout(() => clearTaskMutation(completedVersion), 50);
        }
        if (tasks.length === 0) {
          setHasRenderedTasks(false);
          onTasksExitComplete?.();
        }
      }}
    >
      {tasks.map((task, index) => {
        const orderDetails = getTaskOrderDetails?.(task);
        const rowProps = {
          isOverflow: task.id === overflowTaskId && task.completedAt === null,
          isPending: pending,
          isSelected: selectedTaskId === task.id,
          metadata: getTaskMetadata?.(task),
          onMotionComplete: clearTaskMutation,
          onSelectTask,
          onToggleTask,
          shouldAnimateEnter: task.id === enteringTaskId,
          task,
          taskMutation,
        };

        return draggable ? (
          <SortableTaskRow
            {...rowProps}
            disabled={reorderDisabled}
            itemCount={orderDetails?.itemCount ?? tasks.length}
            key={task.id}
            position={orderDetails?.position ?? index + 1}
            sectionLabel={orderDetails?.sectionLabel ?? label}
            showDragHandle
          />
        ) : (
          <TaskRow {...rowProps} key={task.id} />
        );
      })}
    </AnimatePresence>
  );

  return (
    <section aria-label={label} className={cn("mt-5", className)}>
      <h2 className={cn("m-0 border-b border-border pb-2 text-menu-label font-semibold", emphasized ? "text-foreground" : "text-muted-foreground")}>
        {collapsible ? (
          <button
            aria-controls={contentId}
            aria-expanded={!isCollapsed}
            className="-my-1 flex w-full items-center justify-between rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => setIsManuallyCollapsed((current) => !current)}
            type="button"
          >
            <span>{label}</span>
            <span className="flex items-center gap-1.5 tabular-nums">
              {tasks.length > 0 ? <span>{tasks.length}</span> : null}
              <HugeiconsIcon
                aria-hidden="true"
                className={cn("size-3.5 transition-transform duration-150 motion-reduce:transition-none", !isCollapsed && "rotate-180")}
                icon={ArrowDown01Icon}
                strokeWidth={2}
              />
            </span>
          </button>
        ) : (
          label
        )}
      </h2>
      {isCollapsed ? null : (
        <div id={contentId}>
          {tasks.length === 0 && emptyMessage ? (
            <p className="m-0 border-b border-border py-3 text-menu leading-5 text-muted-foreground">{emptyMessage}</p>
          ) : (
            <TaskList dragTargetId={dragTargetId} isDragTarget={isDragTarget}>
              {draggable ? <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>{rows}</SortableContext> : rows}
            </TaskList>
          )}
        </div>
      )}
    </section>
  );
}

function TaskList({
  children,
  dragTargetId,
  isDragTarget,
}: {
  children: ReactNode;
  dragTargetId?: string;
  isDragTarget: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    disabled: !dragTargetId,
    id: dragTargetId ?? "task-group-drop-target",
  });

  return (
    <ul
      className={cn(
        "m-0 list-none divide-y divide-border p-0 transition-colors duration-150 motion-reduce:transition-none",
        (isOver || isDragTarget) && "bg-muted/60 ring-1 ring-inset ring-ring/50",
      )}
      ref={dragTargetId ? setNodeRef : undefined}
    >
      {children}
    </ul>
  );
}
