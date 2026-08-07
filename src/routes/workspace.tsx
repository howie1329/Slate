import { InboxIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PlannerEmptyState } from "@/components/planner-empty-state";
import { TaskGroup } from "@/components/task-group";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { focusTaskComposer } from "@/lib/task-composer";
import type { PlannerSnapshot } from "@/lib/planner";
import { usePlannerState, useReorderTasks, useSetTaskCompleted } from "@/lib/planner-query";
import {
  calculateCapacityState,
  getBacklogTaskMetadata,
  orderBacklogTasks,
  orderCompletedTasks,
  orderTasks,
  scopeForTask,
} from "@/lib/task-groups";

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
  const reorderTasks = useReorderTasks();
  const setTaskCompleted = useSetTaskCompleted();
  const { recordTaskMutation, taskMutation } = useTaskMotion();
  const { selectedTaskId, selectTask } = useTaskSelection();
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
  const mutationPending = reorderTasks.isPending || setTaskCompleted.isPending;

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

  function handleReorderTasks(taskIds: string[]) {
    reorderTasks.mutate(
      {
        scope: todayScope,
        taskIds,
        expectedRevisions: taskIds.map((id) => {
          const task = tasks.find((candidate) => candidate.id === id);
          return { id, revision: task?.revision ?? 0 };
        }),
      },
      { onError: () => toast.error("Could not save task order.") },
    );
  }

  return (
    <section
      aria-label="Planning workspace"
      className={`flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-2 sm:px-6 sm:pt-3 ${selectedTaskId ? "pb-48" : "pb-24"}`}
    >
      <div className="mx-auto w-full max-w-xl">
        <TaskGroup
          className="mt-2"
          emphasized
          emptyMessage={
            tasks.length > 0
              ? "No commitments yet. Set a time and date on a Backlog task when it is ready for today."
              : undefined
          }
          label="Today"
          onReorderTasks={handleReorderTasks}
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
            getTaskMetadata={(task) => getBacklogTaskMetadata(task, today)}
            label="Backlog"
            onSelectTask={selectTask}
            onToggleTask={toggleTask}
            pending={mutationPending}
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
    </section>
  );
}
