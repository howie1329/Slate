import { InboxIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PlannerEmptyState } from "@/components/planner-empty-state";
import { TaskGroup, type TaskOrderDetails } from "@/components/task-group";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskMoveUndo, WorkspaceMoveFeedback } from "@/components/task-move-undo";
import { useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { focusTaskComposer } from "@/lib/task-composer";
import type { PlannerSnapshot, Task, TaskMoveDestination } from "@/lib/planner";
import { useMoveTask, usePlannerState, useReorderTasks, useSetTaskCompleted } from "@/lib/planner-query";
import {
  buildTaskMoveInput,
  getTaskMoveErrorMessage,
  getTaskMovePreview,
  isEstimateRequiredMoveError,
  type TaskMovePreview,
} from "@/lib/task-move";
import {
  calculateCapacityState,
  formatMinutes,
  getBacklogTaskMetadata,
  orderBacklogTasks,
  orderCompletedTasks,
  orderTasks,
  scopeForTask,
} from "@/lib/task-groups";

const todayDropTargetId = "workspace:today";
const backlogDropTargetId = "workspace:backlog";
const workspaceDragModifiers = [restrictToVerticalAxis];
const workspaceScreenReaderInstructions = {
  draggable:
    "To move this task, press Space or Enter. Use the arrow keys to choose a position, press Space or Enter to drop it, or press Escape to cancel.",
};
const backlogOrderGroups = [
  { label: "Backlog — Needs estimate", scope: "log:needs-estimate" },
  { label: "Backlog — Overdue", scope: "log:overdue" },
  { label: "Backlog — Unscheduled", scope: "log:unscheduled" },
  { label: "Backlog — Upcoming", scope: "log:upcoming" },
] as const;

type PendingTaskMove = {
  taskId: string;
  destination: TaskMoveDestination;
  preview: TaskMovePreview;
};

type WorkspaceTaskOrder = TaskOrderDetails & {
  scope: string;
};

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const planner = usePlannerState();

  if (!planner.data) {
    return null;
  }

  return <UnifiedWorkspace planner={planner.data} />;
}

function UnifiedWorkspace({ planner }: { planner: PlannerSnapshot }) {
  const moveTask = useMoveTask();
  const reorderTasks = useReorderTasks();
  const setTaskCompleted = useSetTaskCompleted();
  const { recordTaskMutation, taskMutation } = useTaskMotion();
  const { isUndoPending, registerSuccessfulMove, reportFeedback } = useTaskMoveUndo();
  const { selectedTaskId, selectTask } = useTaskSelection();
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<TaskMovePreview | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingTaskMove | null>(null);
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
  const { orderByScope, tasks, today } = planner;
  const todayScope = `today:${today}`;
  const todayTasks = orderTasks(
    tasks.filter((task) => task.completedAt === null && scopeForTask(task, today) === todayScope),
    orderByScope,
    todayScope,
  );
  const backlogTasks = orderBacklogTasks(
    tasks.filter((task) => task.completedAt === null && scopeForTask(task, today) !== todayScope),
    orderByScope,
    today,
  );
  const completedTasks = orderCompletedTasks(tasks.filter((task) => task.completedAt !== null));
  const capacity = calculateCapacityState(todayTasks, planner.effectiveCapacityMinutes);
  const taskOrderGroups = [
    { label: "Today", scope: todayScope, tasks: todayTasks },
    ...backlogOrderGroups.map(({ label, scope }) => ({
      label,
      scope,
      tasks: backlogTasks.filter((task) => scopeForTask(task, today) === scope),
    })),
  ].filter((group) => group.tasks.length > 0);
  const taskOrderDetails = new Map<string, WorkspaceTaskOrder>();
  for (const group of taskOrderGroups) {
    group.tasks.forEach((task, index) => {
      taskOrderDetails.set(task.id, {
        itemCount: group.tasks.length,
        position: index + 1,
        scope: group.scope,
        sectionLabel: group.label,
      });
    });
  }
  const mutationPending = moveTask.isPending || reorderTasks.isPending || setTaskCompleted.isPending || isUndoPending;

  function toggleTask(taskId: string, transition: TaskMotionTransition = "instant") {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return;
    }

    recordTaskMutation({
      kind: task.completedAt === null ? "complete" : "restore",
      taskId,
      transition,
    });
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null, expectedRevision: task.revision },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task.") },
    );
  }

  function handleReorderTasks(scope: string, taskIds: string[], task: Task, sectionLabel: string) {
    reorderTasks.mutate(
      {
        scope,
        taskIds,
        expectedRevisions: taskIds.map((id) => {
          const task = tasks.find((candidate) => candidate.id === id);
          return { id, revision: task?.revision ?? 0 };
        }),
      },
      {
        onError: () => reportFeedback("Could not save task order. Your previous order was restored.", true),
        onSuccess: () => {
          const position = taskIds.indexOf(task.id) + 1;
          reportFeedback(`${task.title} moved to position ${position} in ${sectionLabel}.`);
        },
      },
    );
  }

  function destinationForDropTarget(overId: string | null): TaskMoveDestination | null {
    if (!overId) {
      return null;
    }
    if (overId === todayDropTargetId || todayTasks.some((task) => task.id === overId)) {
      return "today";
    }
    if (overId === backlogDropTargetId || backlogTasks.some((task) => task.id === overId)) {
      return "backlog";
    }
    return null;
  }

  function previewTaskMove(task: Task, destination: TaskMoveDestination) {
    return getTaskMovePreview(task, destination, todayTasks, planner.effectiveCapacityMinutes);
  }

  function sectionForTask(task: Task) {
    return taskOrderDetails.get(task.id)?.scope === todayScope ? "today" : "backlog";
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const task = tasks.find((candidate) => candidate.id === String(active.id));
      const order = task ? taskOrderDetails.get(task.id) : undefined;
      return task && order
        ? `Picked up ${task.title} from ${order.sectionLabel}, position ${order.position} of ${order.itemCount}.`
        : undefined;
    },
    onDragOver({ active, over }) {
      const task = tasks.find((candidate) => candidate.id === String(active.id));
      const activeOrder = task ? taskOrderDetails.get(task.id) : undefined;
      const overOrder = over ? taskOrderDetails.get(String(over.id)) : undefined;
      const destination = destinationForDropTarget(over ? String(over.id) : null);
      if (!task || !activeOrder || !destination) {
        return task ? `${task.title} is outside an active planning section.` : undefined;
      }

      const source = sectionForTask(task);
      if (destination === source) {
        if (!overOrder || activeOrder.scope !== overOrder.scope) {
          return `${task.title} remains in ${activeOrder.sectionLabel}. Backlog groups cannot be changed by reordering.`;
        }
        if (active.id === over?.id) {
          return undefined;
        }
        return `${task.title} is over position ${overOrder.position} of ${overOrder.itemCount} in ${overOrder.sectionLabel}.`;
      }

      const preview = previewTaskMove(task, destination);
      if (preview.requiresEstimate) {
        return `${task.title} needs an estimate before it can enter Today.`;
      }
      if (destination === "today") {
        return `${task.title} will move to Today, ${formatMoveDelta(preview.deltaMinutes)}, ${formatMoveCapacity(preview)}.`;
      }
      return `${task.title} will return to Backlog.`;
    },
    onDragEnd({ active, over }) {
      const task = tasks.find((candidate) => candidate.id === String(active.id));
      const activeOrder = task ? taskOrderDetails.get(task.id) : undefined;
      const overOrder = over ? taskOrderDetails.get(String(over.id)) : undefined;
      const destination = destinationForDropTarget(over ? String(over.id) : null);
      if (!task || !activeOrder || !destination) {
        return task ? `${task.title} was not moved.` : undefined;
      }

      const source = sectionForTask(task);
      if (destination === source) {
        if (!overOrder || activeOrder.scope !== overOrder.scope) {
          return `${task.title} remains in ${activeOrder.sectionLabel}.`;
        }
        return `${task.title} was dropped at position ${overOrder.position} of ${overOrder.itemCount} in ${overOrder.sectionLabel}.`;
      }

      const preview = previewTaskMove(task, destination);
      if (preview.requiresEstimate) {
        return `${task.title} was not moved because it needs an estimate.`;
      }
      if (destination === "today" && preview.resultingCapacity.isOverCapacity) {
        return `${task.title} needs confirmation before moving Today over capacity.`;
      }
      return `${task.title} move to ${destination === "today" ? "Today" : "Backlog"} is being saved.`;
    },
    onDragCancel({ active }) {
      const task = tasks.find((candidate) => candidate.id === String(active.id));
      const order = task ? taskOrderDetails.get(task.id) : undefined;
      return task && order ? `Moving ${task.title} in ${order.sectionLabel} was cancelled.` : undefined;
    },
  };

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragTaskId(String(active.id));
    setDragPreview(null);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const task = tasks.find((candidate) => candidate.id === String(active.id));
    const destination = destinationForDropTarget(over ? String(over.id) : null);
    const source = task ? sectionForTask(task) : null;

    if (!task || !destination || destination === source) {
      setDragPreview(null);
      return;
    }

    setDragPreview(previewTaskMove(task, destination));
  }

  function commitMove(task: Task, destination: TaskMoveDestination) {
    recordTaskMutation({ kind: "move", taskId: task.id, transition: "animate" });
    moveTask.mutate(buildTaskMoveInput(task, destination), {
      onSuccess: (moved) => {
        registerSuccessfulMove({ destination, revision: moved.revision, task });
      },
      onError: (error) => {
        if (isEstimateRequiredMoveError(error)) {
          selectTask(task.id, "animate", "estimate");
          toast.error("Set an estimate before committing this task to Today.");
          return;
        }
        toast.error(getTaskMoveErrorMessage(error));
      },
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const task = tasks.find((candidate) => candidate.id === String(active.id));
    const activeOrder = task ? taskOrderDetails.get(task.id) : undefined;
    const overOrder = over ? taskOrderDetails.get(String(over.id)) : undefined;
    const destination = destinationForDropTarget(over ? String(over.id) : null);
    const source = task ? sectionForTask(task) : null;
    setActiveDragTaskId(null);
    setDragPreview(null);

    if (!task || !activeOrder || !destination || !source) {
      return;
    }

    if (destination === source) {
      if (!overOrder || activeOrder.scope !== overOrder.scope) {
        if (over && String(over.id) !== (destination === "today" ? todayDropTargetId : backlogDropTargetId)) {
          reportFeedback("Tasks can only be reordered within their current Backlog group.", true);
        }
        return;
      }
      if (active.id !== over?.id) {
        const group = taskOrderGroups.find((candidate) => candidate.scope === activeOrder.scope);
        if (!group) {
          return;
        }
        const taskIds = group.tasks.map((candidate) => candidate.id);
        const activeIndex = taskIds.indexOf(task.id);
        const overIndex = taskIds.indexOf(String(over?.id));
        if (activeIndex !== -1 && overIndex !== -1) {
          handleReorderTasks(
            activeOrder.scope,
            arrayMove(taskIds, activeIndex, overIndex),
            task,
            activeOrder.sectionLabel,
          );
        }
      }
      return;
    }

    const preview = previewTaskMove(task, destination);
    if (preview.requiresEstimate) {
      selectTask(task.id, "animate", "estimate");
      toast.error("Set an estimate before committing this task to Today.");
      return;
    }
    if (destination === "today" && preview.resultingCapacity.isOverCapacity) {
      setPendingMove({ taskId: task.id, destination, preview });
      return;
    }

    commitMove(task, destination);
  }

  function cancelDrag() {
    setActiveDragTaskId(null);
    setDragPreview(null);
  }

  return (
    <section
      aria-label="Planning workspace"
      className={`flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-2 sm:px-6 sm:pt-3 ${selectedTaskId ? "pb-72" : "pb-24"}`}
    >
      <DndContext
        accessibility={{ announcements, screenReaderInstructions: workspaceScreenReaderInstructions }}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        modifiers={workspaceDragModifiers}
        onDragCancel={cancelDrag}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="mx-auto w-full max-w-xl">
          <WorkspaceMoveFeedback />
          {dragPreview ? <CapacityMovePreview preview={dragPreview} /> : null}
          {pendingMove ? (
            <CapacityMoveConfirmation
              onCancel={() => setPendingMove(null)}
              onConfirm={() => {
                const task = tasks.find((candidate) => candidate.id === pendingMove.taskId);
                if (!task) {
                  setPendingMove(null);
                  return;
                }
                setPendingMove(null);
                commitMove(task, pendingMove.destination);
              }}
              pending={mutationPending}
              preview={pendingMove.preview}
            />
          ) : null}
          <TaskGroup
            className="mt-2"
            dragTargetId={todayDropTargetId}
            draggable
            emphasized
            emptyMessage={
              tasks.length > 0
                ? "No commitments yet. Drag an estimated Backlog task here when it is ready for today."
                : undefined
            }
            isDragTarget={dragPreview?.destination === "today"}
            getTaskOrderDetails={(task) => taskOrderDetails.get(task.id)}
            label="Today"
            onSelectTask={selectTask}
            onToggleTask={toggleTask}
            overflowTaskId={capacity.overflowTaskId}
            pending={mutationPending}
            reorderDisabled={mutationPending}
            selectedTaskId={selectedTaskId}
            taskMutation={taskMutation}
            tasks={todayTasks}
          />

          {tasks.length === 0 ? (
            <PlannerEmptyState
              actionLabel="Add a task"
              description="Capture work below. It starts in Backlog until you give it an estimate and choose Today."
              onAction={focusTaskComposer}
              title="Your day is open."
              transition={taskMutation?.transition ?? "instant"}
            >
              <HugeiconsIcon icon={InboxIcon} strokeWidth={1.8} />
            </PlannerEmptyState>
          ) : null}

          {backlogTasks.length > 0 ? (
            <TaskGroup
              collapsible
              dragTargetId={backlogDropTargetId}
              draggable
              forceExpanded={activeDragTaskId !== null}
              getTaskMetadata={(task) => getBacklogTaskMetadata(task, today)}
              getTaskOrderDetails={(task) => taskOrderDetails.get(task.id)}
              isDragTarget={dragPreview?.destination === "backlog"}
              label="Backlog"
              onSelectTask={selectTask}
              onToggleTask={toggleTask}
              pending={mutationPending}
              reorderDisabled={mutationPending}
              selectedTaskId={selectedTaskId}
              taskMutation={taskMutation}
              tasks={backlogTasks}
            />
          ) : null}

          {completedTasks.length > 0 ? (
            <TaskGroup
              collapsible
              defaultCollapsed
              label="Done"
              onSelectTask={selectTask}
              onToggleTask={toggleTask}
              pending={mutationPending}
              selectedTaskId={selectedTaskId}
              taskMutation={taskMutation}
              tasks={completedTasks}
            />
          ) : null}
        </div>
      </DndContext>
    </section>
  );
}

function CapacityMovePreview({ preview }: { preview: TaskMovePreview }) {
  return (
    <p
      aria-live="polite"
      className={`mt-2 border-b py-2 text-xs leading-4 tabular-nums ${preview.resultingCapacity.isOverCapacity ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground"}`}
      role="status"
    >
      Preview: {preview.destination === "today" ? "Move to Today" : "Return to Backlog"} · {formatMoveDelta(preview.deltaMinutes)} · {formatMoveCapacity(preview)}
    </p>
  );
}

function CapacityMoveConfirmation({
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  preview: TaskMovePreview;
}) {
  return (
    <section aria-label="Confirm over-capacity move" className="mt-2 border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
      <p className="m-0 text-xs leading-4 text-destructive">
        This move adds {formatMinutes(preview.deltaMinutes)} and leaves Today {formatMoveCapacity(preview)}. Existing commitments will stay in place.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button disabled={pending} onClick={onConfirm} size="sm" type="button" variant="destructive">
          Commit over capacity
        </Button>
        <Button disabled={pending} onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function formatMoveDelta(minutes: number) {
  return `${minutes > 0 ? "+" : "−"}${formatMinutes(Math.abs(minutes))}`;
}

function formatMoveCapacity(preview: TaskMovePreview) {
  if (preview.requiresEstimate) {
    return "estimate required";
  }

  return preview.resultingCapacity.isOverCapacity
    ? `${formatMinutes(preview.resultingCapacity.overageMinutes)} over capacity`
    : `${formatMinutes(preview.resultingCapacity.remainingMinutes)} remaining`;
}
