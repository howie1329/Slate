import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";
import { useTaskMotion, type TaskMutationMotion, type TaskMotionTransition } from "@/components/task-motion";
import { SortableTaskRow, TaskRow } from "@/components/task-row";
import type { TaskSelectionTransition } from "@/components/task-selection";
import type { Task } from "@/lib/planner";
import { cn } from "@/lib/utils";

const taskListModifiers = [restrictToVerticalAxis];
const taskListScreenReaderInstructions = {
  draggable:
    "To reorder this task, press Space or Enter. While sorting, use the arrow keys to move it, press Space or Enter to drop it, or press Escape to cancel.",
};

type TaskGroupProps = {
  className?: string;
  label: string;
  onReorderTasks?: (taskIds: string[]) => void;
  onSelectTask: (taskId: string, transition?: TaskSelectionTransition) => void;
  onTasksExitComplete?: () => void;
  onToggleTask: (taskId: string, transition?: TaskMotionTransition) => void;
  overflowTaskId?: string | null;
  pending: boolean;
  reorderDisabled?: boolean;
  selectedTaskId: string | null;
  taskMutation?: TaskMutationMotion | null;
  tasks: Task[];
};

export function TaskGroup({
  className,
  label,
  onReorderTasks,
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
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
  const taskIds = tasks.map((task) => task.id);
  const taskDetails = useMemo(
    () =>
      new Map(
        tasks.map((task, index) => [
          task.id,
          {
            position: index + 1,
            title: task.title,
          },
        ]),
      ),
    [tasks],
  );
  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart({ active }) {
        const task = taskDetails.get(String(active.id));
        return task
          ? `Picked up ${task.title}, position ${task.position} of ${tasks.length} in ${label}.`
          : undefined;
      },
      onDragOver({ active, over }) {
        const activeTask = taskDetails.get(String(active.id));
        const overTask = over ? taskDetails.get(String(over.id)) : undefined;

        if (!activeTask) {
          return undefined;
        }
        if (active.id === over?.id) {
          return undefined;
        }
        if (!overTask) {
          return `${activeTask.title} is outside ${label}.`;
        }

        return `${activeTask.title} moved to position ${overTask.position} of ${tasks.length} in ${label}.`;
      },
      onDragEnd({ active, over }) {
        const activeTask = taskDetails.get(String(active.id));
        const overTask = over ? taskDetails.get(String(over.id)) : undefined;

        if (!activeTask) {
          return undefined;
        }
        if (!overTask || active.id === over?.id) {
          return `${activeTask.title} was not moved.`;
        }

        return `${activeTask.title} was dropped at position ${overTask.position} of ${tasks.length} in ${label}.`;
      },
      onDragCancel({ active }) {
        const task = taskDetails.get(String(active.id));
        return task ? `Reordering ${task.title} was cancelled.` : undefined;
      },
    }),
    [label, taskDetails, tasks.length],
  );

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

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!onReorderTasks || reorderDisabled || !over || active.id === over.id) {
      return;
    }

    const activeIndex = taskIds.indexOf(String(active.id));
    const overIndex = taskIds.indexOf(String(over.id));

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    onReorderTasks(arrayMove(taskIds, activeIndex, overIndex));
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
        const rowProps = {
          isOverflow: task.id === overflowTaskId && task.completedAt === null,
          isPending: pending,
          isSelected: selectedTaskId === task.id,
          onMotionComplete: clearTaskMutation,
          onSelectTask,
          onToggleTask,
          shouldAnimateEnter: task.id === enteringTaskId,
          task,
          taskMutation,
        };

        return onReorderTasks ? (
          <SortableTaskRow
            {...rowProps}
            disabled={reorderDisabled || tasks.length < 2}
            itemCount={tasks.length}
            key={task.id}
            position={index + 1}
            showDragHandle={tasks.length > 1}
          />
        ) : (
          <TaskRow {...rowProps} key={task.id} />
        );
      })}
    </AnimatePresence>
  );

  return (
    <section aria-label={label} className={cn("mt-5", className)}>
      <h2 className="m-0 border-b border-border pb-2 text-menu-label font-medium text-muted-foreground">
        {label}
      </h2>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {onReorderTasks ? (
          <DndContext
            accessibility={{
              announcements,
              screenReaderInstructions: taskListScreenReaderInstructions,
            }}
            collisionDetection={closestCenter}
            modifiers={taskListModifiers}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              {rows}
            </SortableContext>
          </DndContext>
        ) : (
          rows
        )}
      </ul>
    </section>
  );
}
