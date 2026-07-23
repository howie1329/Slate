import { useEffect, useState, type MouseEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { PlannerEmptyState } from "@/components/planner-empty-state";
import { TaskGroup } from "@/components/task-group";
import { useRouteMotion } from "@/components/route-motion";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import type { PlannerSnapshot } from "@/lib/planner";
import { focusTaskComposer } from "@/lib/task-composer";
import { usePlannerState, useSetTaskCompleted } from "@/lib/planner-query";
import { calculateCapacityState, orderTasks, scopeForTask } from "@/lib/task-groups";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  const planner = usePlannerState();

  if (!planner.data) {
    return null;
  }

  return <TodayWorkspace planner={planner.data} />;
}

function TodayWorkspace({ planner }: { planner: PlannerSnapshot }) {
  const setTaskCompleted = useSetTaskCompleted();
  const navigate = useNavigate();
  const { recordTaskMutation, taskMutation } = useTaskMotion();
  const { setRouteTransition } = useRouteMotion();
  const { selectedTaskId, selectTask } = useTaskSelection();

  const { settings, tasks, today, orderByScope } = planner;
  const scheduledToday = tasks.filter((task) => task.scheduledDate === today);
  const todayScope = `today:${today}`;
  const activeTasks = orderTasks(
    tasks.filter((task) => scopeForTask(task, today) === todayScope),
    orderByScope,
    todayScope,
  );
  const completedTasks = scheduledToday
    .filter((task) => task.completedAt !== null)
    .sort((first, second) => (second.completedAt ?? "").localeCompare(first.completedAt ?? ""));
  const hasBacklogTasks = tasks.some(
    (task) => task.completedAt === null && scopeForTask(task, today) !== todayScope,
  );
  const capacityMinutes = settings.dailyCapacityMinutes;
  const capacity = calculateCapacityState(activeTasks, capacityMinutes);
  const { overflowTaskId } = capacity;
  const hasTasks = activeTasks.length > 0 || completedTasks.length > 0;
  const [showEmptyState, setShowEmptyState] = useState(!hasTasks);

  useEffect(() => {
    if (hasTasks) {
      setShowEmptyState(false);
    }
  }, [hasTasks]);

  function toggleTask(taskId: string, transition: TaskMotionTransition = "instant") {
    const task = scheduledToday.find((candidate) => candidate.id === taskId);
    if (!task) return;
    recordTaskMutation({
      kind: task.completedAt === null ? "complete" : "restore",
      taskId,
      transition,
    });
    setTaskCompleted.mutate(
      { id: taskId, completed: task.completedAt === null },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update task.") },
    );
  }

  function handleTasksExitComplete() {
    if (!hasTasks) {
      setShowEmptyState(true);
    }
  }

  return (
    <section className={`flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-2 sm:px-6 sm:pt-3 ${selectedTaskId ? "pb-48" : "pb-24"}`} aria-label="Today tasks">
      <div className="mx-auto w-full max-w-xl">
        <TaskGroup
          className="mt-2"
          label="To do"
          onSelectTask={selectTask}
          onTasksExitComplete={handleTasksExitComplete}
          onToggleTask={toggleTask}
          overflowTaskId={overflowTaskId}
          pending={setTaskCompleted.isPending}
          selectedTaskId={selectedTaskId}
          taskMutation={taskMutation}
          tasks={activeTasks}
        />
        <TaskGroup
          className={activeTasks.length === 0 ? "mt-2" : undefined}
          label="Done"
          onSelectTask={selectTask}
          onTasksExitComplete={handleTasksExitComplete}
          onToggleTask={toggleTask}
          pending={setTaskCompleted.isPending}
          selectedTaskId={selectedTaskId}
          taskMutation={taskMutation}
          tasks={completedTasks}
        />
        {showEmptyState && !hasTasks ? (
          <PlannerEmptyState
            actionLabel={hasBacklogTasks ? "Browse backlog" : "Add a task"}
            description={
              hasBacklogTasks
                ? "Choose what deserves space before you make a commitment."
                : "Add one task below to make your first commitment."
            }
            onAction={(event: MouseEvent<HTMLButtonElement>) => {
              if (hasBacklogTasks) {
                setRouteTransition(event.detail > 0 ? "animate" : "instant");
                void navigate({ to: "/backlog" });
                return;
              }

              focusTaskComposer();
            }}
            title="Your day is open."
            transition={taskMutation?.transition ?? "instant"}
          >
            <HugeiconsIcon icon={Sun01Icon} strokeWidth={1.8} />
          </PlannerEmptyState>
        ) : null}
      </div>
    </section>
  );
}
