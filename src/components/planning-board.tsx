import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Calendar01Icon,
  Clock01Icon,
  InboxIcon,
  Sun01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { useTaskSelection } from "@/components/task-selection";
import { PlanningTaskSheet } from "@/components/planning-task-sheet";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import {
  planningBoardLanes,
  type PlanningBoardFilter,
  type PlanningBoardLane,
  type PlanningBoardSort,
  type PlanningLaneId,
} from "@/lib/planning-board";
import type { PlannerSnapshot, PlanningTask } from "@/lib/planner";
import {
  useReorderTasks,
  useSetTaskCompleted,
  useSetTaskScheduledDate,
  useUpdateTask,
} from "@/lib/planner-query";
import { formatDueDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";

type PlanningBoardProps = {
  filter: PlanningBoardFilter;
  query: string;
  snapshot?: PlannerSnapshot;
  sort: PlanningBoardSort;
};

type LaneFeedback = {
  lane: PlanningLaneId;
  message: string;
};

type CapacityPreview = {
  committedMinutes: number;
  message: string;
};

const laneIcons = {
  capture: InboxIcon,
  ready: Calendar01Icon,
  today: Sun01Icon,
  done: Tick02Icon,
} as const;

export function PlanningBoard({ filter, query, snapshot, sort }: PlanningBoardProps) {
  const { selectTask } = useTaskSelection();
  const reorderTasks = useReorderTasks();
  const setTaskCompleted = useSetTaskCompleted();
  const setTaskScheduledDate = useSetTaskScheduledDate();
  const updateTask = useUpdateTask();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<PlanningLaneId | null>(null);
  const [overTaskId, setOverTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<LaneFeedback | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const lanes = useMemo(
    () => snapshot ? planningBoardLanes(snapshot, query, filter, sort) : [],
    [filter, query, snapshot, sort],
  );
  const tasks = useMemo(() => lanes.flatMap((lane) => lane.tasks), [lanes]);
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const activeLane = activeTask ? laneContainingTask(lanes, activeTask.id) : null;
  const capacityPreview = snapshot && activeTask && activeLane && overLane
    ? previewCapacity(snapshot, activeTask, activeLane, overLane)
    : null;
  const canReorder = filter === "all" && !query.trim() && sort === "planning";
  const mutationPending = reorderTasks.isPending
    || setTaskCompleted.isPending
    || setTaskScheduledDate.isPending
    || updateTask.isPending;

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  if (!snapshot) return <PlanningBoardLoading />;
  const today = snapshot.today;

  function resetDragState() {
    setActiveTaskId(null);
    setOverLane(null);
    setOverTaskId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const taskId = String(event.active.id);
    setActiveTaskId(taskId);
    setOverLane(laneContainingTask(lanes, taskId));
  }

  function handleDragOver(event: DragOverEvent) {
    setOverLane((event.over?.data.current?.lane as PlanningLaneId | undefined) ?? null);
    setOverTaskId((event.over?.data.current?.taskId as string | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const destinationLane = (event.over?.data.current?.lane as PlanningLaneId | undefined) ?? null;
    const destinationTaskId = (event.over?.data.current?.taskId as string | undefined) ?? null;
    const sourceLane = laneContainingTask(lanes, taskId);
    const task = tasks.find((candidate) => candidate.id === taskId);
    resetDragState();

    if (!task || !sourceLane || !destinationLane || sourceLane === "done") return;

    if (sourceLane === destinationLane) {
      if (!canReorder || !destinationTaskId || destinationTaskId === taskId) return;
      const lane = lanes.find((candidate) => candidate.id === sourceLane);
      const guard = lane?.reorder;
      if (!lane || !guard) return;
      const previousIndex = lane.tasks.findIndex((candidate) => candidate.id === taskId);
      const nextIndex = lane.tasks.findIndex((candidate) => candidate.id === destinationTaskId);
      if (previousIndex < 0 || nextIndex < 0) return;
      reorderTasks.mutate(
        { guard, taskIds: arrayMove(lane.tasks, previousIndex, nextIndex).map((candidate) => candidate.id) },
        { onError: () => toast.error("Could not save task order.") },
      );
      return;
    }

    moveTask(task, destinationLane);
  }

  function moveTask(task: PlanningTask, destination: PlanningLaneId) {
    if (destination === "ready" && task.estimateMinutes === null) {
      setFeedback({ lane: "ready", message: "Add an estimate to make this task Ready." });
      selectTask(task.id);
      return;
    }

    setPendingTaskId(task.id);
    const onError = (error: unknown) => {
      setPendingTaskId(null);
      toast.error(plannerMutationErrorMessage(error, "Could not move task."));
    };
    const onSuccess = () => setPendingTaskId(null);

    if (destination === "done") {
      setTaskCompleted.mutate(
        { id: task.id, completed: true, expectedRevision: task.revision },
        { onError, onSuccess },
      );
      return;
    }

    if (destination === "today") {
      setTaskScheduledDate.mutate(
        { id: task.id, scheduledDate: today, expectedRevision: task.revision },
        { onError, onSuccess },
      );
      return;
    }

    updateTask.mutate(
      {
        id: task.id,
        title: task.title,
        estimateMinutes: destination === "capture" ? null : task.estimateMinutes,
        scheduledDate: task.scheduledDate === today ? null : task.scheduledDate,
        anchorDate: task.anchorDate,
        expectedRevision: task.revision,
      },
      { onError, onSuccess },
    );
  }

  return (
    <section aria-label="Planning board" className="h-full min-h-0 overflow-x-auto overflow-y-hidden bg-background">
      <h1 className="sr-only">Planning board</h1>
      <DndContext
        collisionDetection={closestCenter}
        onDragCancel={resetDragState}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="grid h-full min-w-[920px] grid-cols-4">
          {lanes.map((lane) => (
            <PlanningLane
              activeLane={activeLane}
              activeTask={activeTask}
              canReorder={canReorder}
              capacity={lane.id === "today" ? snapshot.planning.today.capacity : undefined}
              capacityPreview={lane.id === "today" ? capacityPreview : null}
              feedback={feedback?.lane === lane.id ? feedback.message : null}
              key={lane.id}
              lane={lane}
              mutationPending={mutationPending}
              overLane={overLane}
              overTaskId={overTaskId}
              pendingTaskId={pendingTaskId}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
          {activeTask && activeLane ? (
            <div className="w-[min(280px,24vw)] min-w-48 rotate-[0.35deg] rounded-md bg-card shadow-md ring-1 ring-foreground/15">
              <PlanningBoardCardContent lane={activeLane} task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <span aria-live="polite" className="sr-only" role="status">
        {feedback?.message ?? (pendingTaskId ? "Moving task." : "")}
      </span>
      <PlanningTaskSheet snapshot={snapshot} />
    </section>
  );
}

function PlanningLane({
  activeLane,
  activeTask,
  canReorder,
  capacity,
  capacityPreview,
  feedback,
  lane,
  mutationPending,
  overLane,
  overTaskId,
  pendingTaskId,
}: {
  activeLane: PlanningLaneId | null;
  activeTask: PlanningTask | null;
  canReorder: boolean;
  capacity?: PlannerSnapshot["planning"]["today"]["capacity"];
  capacityPreview: CapacityPreview | null;
  feedback: string | null;
  lane: PlanningBoardLane;
  mutationPending: boolean;
  overLane: PlanningLaneId | null;
  overTaskId: string | null;
  pendingTaskId: string | null;
}) {
  const { id, label, tasks } = lane;
  const Icon = laneIcons[id];
  const [doneCollapsed, setDoneCollapsed] = useState(id === "done" && tasks.length > 6);
  const { isOver, setNodeRef } = useDroppable({ id: `planning-lane:${id}`, data: { lane: id } });
  const previewCommittedMinutes = capacityPreview?.committedMinutes ?? capacity?.committedMinutes ?? 0;
  const capacityPercent = capacity
    ? Math.min(100, Math.round((previewCommittedMinutes / Math.max(1, capacity.limitMinutes)) * 100))
    : 0;
  const previewIsOverCapacity = capacity ? previewCommittedMinutes > capacity.limitMinutes : false;
  const isTargeted = Boolean(activeTask && overLane === id);
  const isValidTarget = activeTask ? validDropTarget(activeTask, activeLane, id, canReorder) : false;
  const showCollapsedDone = id === "done" && doneCollapsed && !activeTask;

  return (
    <section
      aria-labelledby={`planning-lane-${id}`}
      className={cn(
        "relative flex h-full min-h-0 min-w-0 flex-col border-r border-border transition-[background-color] duration-150 last:border-r-0 motion-reduce:transition-none",
        id === "today" && "bg-muted/20 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-px before:bg-transparent before:transition-colors before:duration-150 motion-reduce:before:transition-none",
        id === "today" && activeTask && activeLane !== "today" && "before:bg-foreground/20",
        id === "today" && isTargeted && isValidTarget && "before:bg-foreground/70",
        isTargeted && isValidTarget && "bg-muted/35",
      )}
      data-planning-lane={id}
      ref={setNodeRef}
    >
      <header className="flex min-h-[72px] shrink-0 flex-col justify-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon aria-hidden="true" className={cn(id !== "today" && "text-muted-foreground")} icon={Icon} size={14} strokeWidth={1.7} />
          <h2 className={cn("m-0 text-section-secondary", id === "today" ? "font-semibold" : "font-medium")} id={`planning-lane-${id}`}>{label}</h2>
          <span className="rounded bg-muted px-1.5 py-0.5 text-estimate tabular-nums text-muted-foreground">
            {tasks.length}
          </span>
          {id === "done" && tasks.length > 6 ? (
            <button
              aria-expanded={!doneCollapsed}
              aria-label={`${doneCollapsed ? "Show" : "Hide"} completed tasks`}
              className="ml-auto rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setDoneCollapsed((collapsed) => !collapsed)}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" icon={doneCollapsed ? ArrowDown01Icon : ArrowUp01Icon} size={12} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
        {capacity ? (
          <div className="space-y-1">
            <div className={cn("text-capacity tabular-nums", previewIsOverCapacity ? "text-destructive" : "text-muted-foreground")}>
              {capacityPreview ? capacityPreview.message : capacityLabel(capacity.remainingMinutes, capacity.overageMinutes, capacity.isOverCapacity)}
            </div>
            <div
              aria-label={`${previewCommittedMinutes} of ${capacity.limitMinutes} minutes committed`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={capacityPercent}
              className="h-0.5 w-full overflow-hidden rounded-full bg-secondary"
              role="progressbar"
            >
              <span
                className={cn(
                  "block h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none",
                  previewIsOverCapacity ? "bg-destructive/80" : capacityPreview ? "bg-foreground" : "bg-foreground/70",
                )}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="m-0 text-[10px] leading-3 text-muted-foreground">{laneDescription(id)}</p>
        )}
      </header>

      {feedback ? (
        <div className="mx-2 mt-2 rounded-md bg-muted px-2 py-1.5 text-[10px] leading-3.5 text-foreground" role="status">
          {feedback}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {showCollapsedDone ? (
          <button
            className="flex w-full items-center justify-center rounded-md py-3 text-[10px] text-muted-foreground outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setDoneCollapsed(false)}
            type="button"
          >
            Show {tasks.length} completed tasks
          </button>
        ) : tasks.length ? (
          <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            <ul className="m-0 list-none space-y-1 p-0">
              {tasks.map((task) => (
                <PlanningBoardCard
                  activeLane={activeLane}
                  activeTaskId={activeTask?.id ?? null}
                  canReorder={canReorder}
                  key={task.id}
                  lane={id}
                  overTaskId={overTaskId}
                  pending={mutationPending && (pendingTaskId === null || pendingTaskId === task.id)}
                  task={task}
                />
              ))}
            </ul>
          </SortableContext>
        ) : (
          <div className={cn(
            "flex min-h-28 items-center justify-center rounded-md px-4 text-center text-[10px] leading-4 text-muted-foreground transition-colors duration-150 motion-reduce:transition-none",
            isOver && isValidTarget && "bg-muted/60 text-foreground",
          )}>
            {activeTask && isOver && isValidTarget ? dropTargetMessage(id, activeTask) : emptyLaneMessage(id)}
          </div>
        )}
      </div>
    </section>
  );
}

function PlanningBoardCard({
  activeLane,
  activeTaskId,
  canReorder,
  lane,
  overTaskId,
  pending,
  task,
}: {
  activeLane: PlanningLaneId | null;
  activeTaskId: string | null;
  canReorder: boolean;
  lane: PlanningLaneId;
  overTaskId: string | null;
  pending: boolean;
  task: PlanningTask;
}) {
  const { selectedTaskId, selectTask } = useTaskSelection();
  const selected = selectedTaskId === task.id;
  const sortable = useSortable({
    data: { lane, taskId: task.id },
    disabled: pending || lane === "done",
    id: task.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const showInsertion = activeTaskId !== null
    && activeTaskId !== task.id
    && activeLane === lane
    && overTaskId === task.id
    && canReorder;

  return (
    <li className={cn("relative", sortable.isDragging && "z-10")} ref={sortable.setNodeRef} style={style}>
      {showInsertion ? <span aria-hidden="true" className="absolute -top-[3px] left-2 right-2 z-10 h-px rounded-full bg-foreground" /> : null}
      <button
        {...sortable.attributes}
        {...sortable.listeners}
        aria-pressed={selected}
        className={cn(
          "group w-full touch-none rounded-md border border-border/70 bg-card/70 px-2.5 py-2 text-left outline-none transition-[background-color,box-shadow,opacity,transform] duration-150 hover:bg-card hover:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45 motion-reduce:transition-none",
          selected && "bg-muted ring-1 ring-inset ring-foreground/20",
          lane === "done" && "bg-transparent text-muted-foreground opacity-75",
          sortable.isDragging && "opacity-25",
          pending && "cursor-wait opacity-55",
          !pending && lane !== "done" && "cursor-grab active:cursor-grabbing",
        )}
        data-task-row
        disabled={pending}
        onClick={() => selectTask(task.id)}
        type="button"
      >
        <PlanningBoardCardContent lane={lane} task={task} />
      </button>
    </li>
  );
}

function PlanningBoardCardContent({ lane, task }: { lane: PlanningLaneId; task: PlanningTask }) {
  const metadata = taskMetadata(task, lane);

  return (
    <>
      <span className="flex min-w-0 items-start gap-2">
        {lane === "done" ? (
          <HugeiconsIcon aria-hidden="true" className="mt-px shrink-0" icon={Tick02Icon} size={12} strokeWidth={1.6} />
        ) : lane === "today" ? (
          <HugeiconsIcon aria-hidden="true" className="mt-px shrink-0 text-muted-foreground" icon={Clock01Icon} size={12} strokeWidth={1.6} />
        ) : null}
        <span className={cn("min-w-0 flex-1 truncate text-[13px] font-normal leading-4 text-foreground", lane === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        {task.estimateMinutes !== null ? (
          <span className="shrink-0 text-[10px] font-normal leading-3 tabular-nums text-muted-foreground">
            {formatMinutes(task.estimateMinutes)}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] leading-3 text-muted-foreground">
        {lane === "capture" ? <span className="font-medium text-foreground">Needs estimate</span> : null}
        {metadata.map((item, index) => (
          <span className="flex min-w-0 items-center gap-1" key={`${item}-${index}`}>
            {index > 0 || lane === "capture" ? <span aria-hidden="true">·</span> : null}
            <span className="truncate">{item}</span>
          </span>
        ))}
      </span>
    </>
  );
}

function laneContainingTask(lanes: PlanningBoardLane[], taskId: string) {
  return lanes.find((lane) => lane.tasks.some((task) => task.id === taskId))?.id ?? null;
}

function validDropTarget(
  task: PlanningTask,
  source: PlanningLaneId | null,
  destination: PlanningLaneId,
  canReorder: boolean,
) {
  if (!source || source === "done") return false;
  if (source === destination) return canReorder;
  if (destination === "ready") return task.estimateMinutes !== null;
  return true;
}

function previewCapacity(
  snapshot: PlannerSnapshot,
  task: PlanningTask,
  source: PlanningLaneId,
  destination: PlanningLaneId,
): CapacityPreview | null {
  const capacity = snapshot.planning.today.capacity;
  const crossingIntoToday = source !== "today" && destination === "today";
  const crossingOutOfToday = source === "today" && destination !== "today";
  if (!crossingIntoToday && !crossingOutOfToday) return null;
  if (task.estimateMinutes === null) {
    return {
      committedMinutes: capacity.committedMinutes,
      message: crossingIntoToday ? "No estimate · known capacity unchanged" : "Removing unsized commitment",
    };
  }

  const nextCommitted = Math.max(
    0,
    capacity.committedMinutes + (crossingIntoToday ? task.estimateMinutes : -task.estimateMinutes),
  );
  return {
    committedMinutes: nextCommitted,
    message: `${remainingCapacityLabel(capacity.limitMinutes, capacity.committedMinutes)} → ${remainingCapacityLabel(capacity.limitMinutes, nextCommitted)}`,
  };
}

function remainingCapacityLabel(limitMinutes: number, committedMinutes: number) {
  const remaining = limitMinutes - committedMinutes;
  return remaining >= 0 ? `${formatMinutes(remaining)} remaining` : `${formatMinutes(Math.abs(remaining))} over`;
}

function capacityLabel(remainingMinutes: number, overageMinutes: number, isOverCapacity: boolean) {
  return isOverCapacity ? `${formatMinutes(overageMinutes)} over capacity` : `${formatMinutes(remainingMinutes)} remaining`;
}

function taskMetadata(task: PlanningTask, lane: PlanningLaneId) {
  if (lane === "done") {
    return [task.completedAt ? `Completed ${formatTimestamp(task.completedAt)}` : "Completed"];
  }
  if (lane === "today") return [task.estimateMinutes === null ? "No estimate" : "Committed today"];

  const metadata: string[] = [];
  if (task.badges.includes("overdue")) metadata.push("Overdue");
  else if (task.badges.includes("upcoming")) metadata.push("Upcoming");
  else if (task.scheduledDate) metadata.push(formatDueDate(task.scheduledDate));
  else metadata.push("Backlog");
  return metadata;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function laneDescription(id: PlanningLaneId) {
  if (id === "capture") return "Shape before committing";
  if (id === "ready") return "Estimated and available";
  return "Completed work";
}

function emptyLaneMessage(id: PlanningLaneId) {
  if (id === "capture") return "Nothing waiting to be shaped.";
  if (id === "ready") return "Estimated tasks will appear here.";
  if (id === "today") return "Your day is open.";
  return "Completed tasks will collect here.";
}

function dropTargetMessage(id: PlanningLaneId, task: PlanningTask) {
  if (id === "today") return task.estimateMinutes === null ? "Commit without changing known capacity" : "Commit to Today";
  if (id === "ready") return "Make available";
  if (id === "capture") return "Return for shaping";
  return "Complete task";
}

function PlanningBoardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading planning board" className="grid h-full min-w-[920px] grid-cols-4 overflow-hidden">
      {[0, 1, 2, 3].map((lane) => (
        <div className={cn("border-r border-border p-3 last:border-r-0", lane === 2 && "bg-muted/20")} key={lane}>
          <div className="mb-6 h-4 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          {[0, 1, 2, 3].map((card) => (
            <div className="mb-2 h-14 animate-pulse rounded-md border border-border/70 bg-muted/50 motion-reduce:animate-none" key={card} />
          ))}
        </div>
      ))}
    </div>
  );
}
