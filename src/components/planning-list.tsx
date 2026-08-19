import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Calendar01Icon,
  DragDropVerticalIcon,
  InboxIcon,
  Sun01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useTaskSelection } from "@/components/task-selection";
import {
  planningBoardLanes,
  type PlanningBoardFilter,
  type PlanningBoardLane,
  type PlanningBoardSort,
  type PlanningLaneId,
} from "@/lib/planning-board";
import {
  idlePlanningInteraction,
  planningInteraction,
  type CapacityPreview,
  type PlanningBoardEvent,
  type PlanningInteractionEffect,
} from "@/lib/planning-interaction";
import type { PlannerSnapshot, PlanningTask } from "@/lib/planner";
import {
  useReorderTasks,
  useSetTaskCompleted,
  useSetTaskScheduledDate,
  useUpdateTask,
} from "@/lib/planner-query";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import { formatDueDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";

type PlanningListProps = {
  filter: PlanningBoardFilter;
  snapshot?: PlannerSnapshot;
  sort: PlanningBoardSort;
};

const laneIcons = {
  capture: InboxIcon,
  ready: Calendar01Icon,
  today: Sun01Icon,
  done: Tick02Icon,
} as const;

export function PlanningList({ filter, snapshot, sort }: PlanningListProps) {
  const { selectTask } = useTaskSelection();
  const reorderTasks = useReorderTasks();
  const setTaskCompleted = useSetTaskCompleted();
  const setTaskScheduledDate = useSetTaskScheduledDate();
  const updateTask = useUpdateTask();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [interaction, setInteraction] = useState(idlePlanningInteraction);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<PlanningLaneId, boolean>>({
    capture: false,
    ready: false,
    today: false,
    done: false,
  });
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const lanes = useMemo(
    () => snapshot ? planningBoardLanes(snapshot, filter, sort) : [],
    [filter, snapshot, sort],
  );
  const tasks = useMemo(() => lanes.flatMap((lane) => lane.tasks), [lanes]);
  const backlogLanes = lanes.filter((lane) => lane.id !== "today");
  const todayLane = lanes.find((lane) => lane.id === "today");
  const backlogTaskCount = backlogLanes.reduce((total, lane) => total + lane.tasks.length, 0);
  const activeTask = tasks.find((task) => task.id === interaction.activeTaskId) ?? null;
  const activeLane = interaction.sourceLane;
  const canReorder = filter === "all" && sort === "planning";
  const mutationPending = reorderTasks.isPending
    || setTaskCompleted.isPending
    || setTaskScheduledDate.isPending
    || updateTask.isPending;

  if (!snapshot) return <PlanningListLoading />;

  const interactionContext = {
    lanes,
    today: snapshot.today,
    capacity: snapshot.planning.capacity,
    canReorder,
  };

  function transitionInteraction(event: PlanningBoardEvent) {
    const result = planningInteraction({ kind: "board", context: interactionContext, state: interaction, event });
    if (result.kind !== "board") return;
    setInteraction(result.state);
    if (result.effect) executeEffect(result.effect);
  }

  function executeEffect(effect: PlanningInteractionEffect) {
    if (effect.type === "reorder") {
      reorderTasks.mutate(
        { guard: effect.guard, lane: effect.lane, taskIds: effect.taskIds },
        { onError: () => toast.error("Could not save task order.") },
      );
      return;
    }
    if (effect.type === "inspect") {
      selectTask(effect.taskId, "animate", effect.feedback.lane);
      toast.message(effect.feedback.message);
      return;
    }

    setPendingTaskId(effect.input.id);
    const onError = (error: unknown) => {
      setPendingTaskId(null);
      toast.error(plannerMutationErrorMessage(error, "Could not move task."));
    };
    const onSuccess = () => setPendingTaskId(null);
    if (effect.type === "set-completed") {
      setTaskCompleted.mutate(effect.input, { onError, onSuccess });
    } else if (effect.type === "set-scheduled-date") {
      setTaskScheduledDate.mutate(effect.input, { onError, onSuccess });
    } else {
      updateTask.mutate(effect.input, { onError, onSuccess });
    }
  }

  function handleToggleCompleted(task: PlanningTask) {
    setPendingTaskId(task.id);
    setTaskCompleted.mutate(
      { id: task.id, completed: task.completedAt === null, expectedRevision: task.revision },
      {
        onError: (error) => {
          setPendingTaskId(null);
          toast.error(plannerMutationErrorMessage(error, "Could not update task."));
        },
        onSuccess: () => setPendingTaskId(null),
      },
    );
  }

  function toggleLane(lane: PlanningLaneId) {
    setCollapsedLanes((current) => ({ ...current, [lane]: !current[lane] }));
  }

  return (
    <section aria-label="Planning list" className="h-full min-h-0 overflow-hidden bg-background outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" data-planning-list tabIndex={-1}>
      <h1 className="sr-only">Planning list</h1>
      <DndContext
        collisionDetection={closestCenter}
        onDragCancel={() => transitionInteraction({ type: "drag-cancel" })}
        onDragEnd={(event) => transitionInteraction({
          type: "drop",
          lane: (event.over?.data.current?.lane as PlanningLaneId | undefined) ?? null,
          taskId: (event.over?.data.current?.taskId as string | undefined) ?? null,
        })}
        onDragOver={(event: DragOverEvent) => transitionInteraction({
          type: "drag-over",
          lane: (event.over?.data.current?.lane as PlanningLaneId | undefined) ?? null,
          taskId: (event.over?.data.current?.taskId as string | undefined) ?? null,
        })}
        onDragStart={(event: DragStartEvent) => transitionInteraction({ type: "drag-start", taskId: String(event.active.id) })}
        sensors={sensors}
      >
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[minmax(0,1fr)_minmax(16rem,auto)]">
          <div className="min-h-0 overflow-y-auto overscroll-contain border-r border-border max-[900px]:border-r-0 max-[900px]:border-b">
            <div className="w-full px-5 pb-8 pt-0 max-[639px]:px-2">
              <div className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-border bg-background px-2">
                <h2 className="m-0 text-menu font-semibold">All work</h2>
                <span className="text-estimate tabular-nums text-muted-foreground">{backlogTaskCount} tasks</span>
              </div>
              {backlogLanes.map((lane) => (
                <PlanningListLane
                  activeLane={activeLane}
                  activeTask={activeTask}
                  canReorder={canReorder}
                  capacityPreview={null}
                  collapsed={collapsedLanes[lane.id]}
                  key={lane.id}
                  lane={lane}
                  mutationPending={mutationPending}
                  onComplete={handleToggleCompleted}
                  onToggle={() => toggleLane(lane.id)}
                  overLane={interaction.overLane}
                  overTargetValid={interaction.validOverTarget}
                  overTaskId={interaction.overTaskId}
                  pendingTaskId={pendingTaskId}
                />
              ))}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain bg-muted/15 max-[900px]:border-t max-[900px]:border-border">
            <div className="h-full w-full px-5 pb-8 pt-0 max-[639px]:px-2">
              {todayLane ? (
                <PlanningListLane
                  activeLane={activeLane}
                  activeTask={activeTask}
                  canReorder={canReorder}
                  capacity={snapshot.planning.capacity}
                  capacityPreview={interaction.capacityPreview}
                  collapsed={collapsedLanes.today}
                  isTodayPane
                  lane={todayLane}
                  mutationPending={mutationPending}
                  onComplete={handleToggleCompleted}
                  onToggle={() => toggleLane("today")}
                  overLane={interaction.overLane}
                  overTargetValid={interaction.validOverTarget}
                  overTaskId={interaction.overTaskId}
                  pendingTaskId={pendingTaskId}
                />
              ) : null}
            </div>
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
          {activeTask && activeLane ? <ListDragPreview lane={activeLane} task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
      <span aria-live="polite" className="sr-only" role="status">{pendingTaskId ? "Saving task." : ""}</span>
    </section>
  );
}

function PlanningListLane({
  activeLane,
  activeTask,
  canReorder,
  capacity,
  capacityPreview,
  collapsed,
  isTodayPane = false,
  lane,
  mutationPending,
  onComplete,
  onToggle,
  overLane,
  overTargetValid,
  overTaskId,
  pendingTaskId,
}: {
  activeLane: PlanningLaneId | null;
  activeTask: PlanningTask | null;
  canReorder: boolean;
  capacity?: PlannerSnapshot["planning"]["capacity"];
  capacityPreview: CapacityPreview | null;
  collapsed: boolean;
  isTodayPane?: boolean;
  lane: PlanningBoardLane;
  mutationPending: boolean;
  onComplete: (task: PlanningTask) => void;
  onToggle: () => void;
  overLane: PlanningLaneId | null;
  overTargetValid: boolean;
  overTaskId: string | null;
  pendingTaskId: string | null;
}) {
  const { id, label, tasks } = lane;
  const Icon = laneIcons[id];
  const { isOver, setNodeRef } = useDroppable({ id: `planning-list-lane:${id}`, data: { lane: id } });
  const committedMinutes = capacityPreview?.committedMinutes ?? capacity?.committedMinutes ?? 0;
  const capacityPercent = capacity ? Math.min(100, Math.round((committedMinutes / Math.max(1, capacity.limitMinutes)) * 100)) : 0;
  const isOverCapacity = capacity ? committedMinutes > capacity.limitMinutes : false;
  const isTargeted = Boolean(activeTask && overLane === id);
  const isValidTarget = isTargeted && overTargetValid;

  return (
    <section aria-labelledby={`planning-list-lane-${id}`} className={cn("relative border-b border-border last:border-b-0", isTodayPane && "flex min-h-full flex-col border-b-0", !isTodayPane && id === "today" && "bg-muted/15", isTargeted && isValidTarget && "bg-muted/35")} data-planning-list-lane={id} ref={setNodeRef}>
      <button aria-controls={`planning-list-lane-content-${id}`} aria-expanded={!collapsed} className={cn("flex min-h-12 w-full items-center gap-2 px-2 text-left outline-none transition-colors duration-150 hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none", isTodayPane && "sticky top-0 z-10 min-h-16 bg-muted/15")} onClick={onToggle} type="button">
        <HugeiconsIcon aria-hidden="true" icon={collapsed ? ArrowDown01Icon : ArrowUp01Icon} size={13} strokeWidth={1.8} />
        <HugeiconsIcon aria-hidden="true" className={cn(id !== "today" && "text-muted-foreground")} icon={Icon} size={15} strokeWidth={1.7} />
        <span className={cn("text-menu", id === "today" ? "font-semibold" : "font-medium")} id={`planning-list-lane-${id}`}>{label}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-estimate tabular-nums text-muted-foreground">{tasks.length}</span>
        {capacity ? (
          <span className={cn("ml-auto flex items-center gap-3 text-capacity tabular-nums", isOverCapacity ? "text-destructive" : "text-muted-foreground")}>
            {capacityPreview ? capacityPreview.message : capacityLabel(capacity.remainingMinutes, capacity.overageMinutes, capacity.isOverCapacity)}
            <span aria-label={`${committedMinutes} of ${capacity.limitMinutes} minutes committed`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={capacityPercent} className="h-1 w-24 overflow-hidden rounded-full bg-secondary max-[639px]:w-14" role="progressbar"><span aria-hidden="true" className={cn("block h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none", isOverCapacity ? "bg-destructive/80" : "bg-foreground/70")} style={{ width: `${capacityPercent}%` }} /></span>
          </span>
        ) : null}
      </button>
      {!collapsed ? tasks.length ? (
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className={cn("m-0 list-none p-0", isTodayPane && "flex-1")} id={`planning-list-lane-content-${id}`}>
            {tasks.map((task) => (
              <PlanningListRow activeLane={activeLane} activeTaskId={activeTask?.id ?? null} canReorder={canReorder} key={task.id} lane={id} onComplete={onComplete} overTaskId={overTaskId} pending={mutationPending && (pendingTaskId === null || pendingTaskId === task.id)} task={task} />
            ))}
          </ul>
        </SortableContext>
      ) : (
        <div className={cn("flex min-h-20 items-center justify-center px-4 pb-4 text-center text-supporting text-muted-foreground", isTodayPane && "min-h-0 flex-1", isOver && isValidTarget && "text-foreground")} id={`planning-list-lane-content-${id}`}>
          {activeTask && isOver && isValidTarget ? dropTargetMessage(id, activeTask) : emptyLaneMessage(id)}
        </div>
      ) : null}
    </section>
  );
}

function PlanningListRow({
  activeLane,
  activeTaskId,
  canReorder,
  lane,
  onComplete,
  overTaskId,
  pending,
  task,
}: {
  activeLane: PlanningLaneId | null;
  activeTaskId: string | null;
  canReorder: boolean;
  lane: PlanningLaneId;
  onComplete: (task: PlanningTask) => void;
  overTaskId: string | null;
  pending: boolean;
  task: PlanningTask;
}) {
  const { selectedTaskId, selectTask } = useTaskSelection();
  const selected = selectedTaskId === task.id;
  const sortable = useSortable({ data: { lane, taskId: task.id }, disabled: pending || lane === "done" || !canReorder, id: task.id });
  const style: CSSProperties = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const showInsertion = activeTaskId !== null && activeTaskId !== task.id && activeLane === lane && overTaskId === task.id && canReorder;
  const metadata = taskMetadata(task, lane);

  return (
    <li className={cn("relative border-t border-border/80", sortable.isDragging && "z-10")} ref={sortable.setNodeRef} style={style}>
      {showInsertion ? <span aria-hidden="true" className="absolute -top-px left-10 right-10 z-10 h-px bg-foreground" /> : null}
      <div className={cn("grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 transition-[background-color,opacity,transform] duration-150 hover:bg-muted/45 motion-reduce:transition-none", selected && "bg-muted", lane === "done" && "text-muted-foreground", sortable.isDragging && "opacity-30", pending && "cursor-wait opacity-55")} data-task-row data-task-id={task.id}>
        <button aria-label={task.completedAt ? `Mark ${task.title} active` : `Complete ${task.title}`} className="flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" disabled={pending} onClick={() => onComplete(task)} type="button">
          <span className={cn("flex size-4 items-center justify-center rounded-full border", task.completedAt ? "border-foreground bg-foreground text-primary-foreground" : "border-muted-foreground/60")}>{task.completedAt ? <HugeiconsIcon aria-hidden="true" icon={Tick02Icon} size={11} strokeWidth={2} /> : null}</span>
        </button>
        <button aria-pressed={selected} className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" disabled={pending} onClick={() => selectTask(task.id)} type="button">
          <span className={cn("block truncate text-menu leading-5", task.completedAt && "text-muted-foreground line-through")}>{task.title}</span>
          {metadata.length ? <span className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-metadata text-muted-foreground">{metadata.map((item, index) => <span key={`${item}-${index}`}>{index ? ` · ${item}` : item}</span>)}</span> : null}
        </button>
        <span className="shrink-0 text-estimate tabular-nums text-muted-foreground">{task.estimateMinutes === null ? "—" : formatMinutes(task.estimateMinutes)}</span>
        <button {...sortable.attributes} {...sortable.listeners} aria-label={`Reorder ${task.title}`} className="flex size-7 items-center justify-center rounded text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40" disabled={pending || lane === "done" || !canReorder} title={canReorder ? "Reorder task" : "Reordering is available in planning order"} type="button">
          <HugeiconsIcon aria-hidden="true" icon={DragDropVerticalIcon} size={15} strokeWidth={1.7} />
        </button>
      </div>
    </li>
  );
}

function ListDragPreview({ lane, task }: { lane: PlanningLaneId; task: PlanningTask }) {
  const metadata = taskMetadata(task, lane);

  return (
    <div className="grid min-h-12 w-full origin-center scale-[1.01] cursor-grabbing grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md bg-card px-2 shadow-md ring-1 ring-foreground/20 motion-reduce:scale-100">
      <span aria-hidden="true" className="flex size-7 items-center justify-center text-muted-foreground">
        <span className="size-4 rounded-full border border-muted-foreground/60" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-menu leading-5">{task.title}</span>
        {metadata.length ? (
          <span className="mt-0.5 block truncate text-metadata text-muted-foreground">
            {metadata.join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-estimate tabular-nums text-muted-foreground">
        {task.estimateMinutes === null ? "—" : formatMinutes(task.estimateMinutes)}
      </span>
      <span aria-hidden="true" className="flex size-7 items-center justify-center text-muted-foreground">
        <HugeiconsIcon icon={DragDropVerticalIcon} size={15} strokeWidth={1.7} />
      </span>
    </div>
  );
}

function taskMetadata(task: PlanningTask, lane: PlanningLaneId) {
  if (lane === "done") return [task.completedAt ? `Completed ${formatTimestamp(task.completedAt)}` : "Completed"];
  if (lane === "today") return [task.estimateMinutes === null ? "Needs estimate" : "Committed today"];
  if (lane === "capture") return ["Needs estimate"];
  if (task.badges.includes("overdue")) return ["Overdue"];
  if (task.badges.includes("upcoming")) return ["Upcoming"];
  if (task.scheduledDate) return [formatDueDate(task.scheduledDate)];
  return ["Backlog"];
}

function capacityLabel(remainingMinutes: number, overageMinutes: number, isOverCapacity: boolean) {
  return isOverCapacity ? `${formatMinutes(overageMinutes)} over capacity` : `${formatMinutes(remainingMinutes)} remaining`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
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

function PlanningListLoading() {
  return (
    <div aria-busy="true" aria-label="Loading planning list" className="grid h-full min-h-0 grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[minmax(0,1fr)_minmax(16rem,auto)]">
      <div className="min-h-0 overflow-hidden border-r border-border px-5 max-[900px]:border-r-0 max-[900px]:border-b max-[639px]:px-2">
        <div className="flex min-h-14 items-center border-b border-border px-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((row) => <div className="h-12 animate-pulse border-b border-border bg-muted/45 motion-reduce:animate-none" key={row} />)}
      </div>
      <div className="min-h-0 overflow-hidden bg-muted/15 px-5 max-[900px]:border-t max-[900px]:border-border max-[639px]:px-2">
        <div className="flex min-h-16 items-center border-b border-border">
          <div className="h-4 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
        <div className="flex h-32 items-center justify-center">
          <div className="h-4 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
