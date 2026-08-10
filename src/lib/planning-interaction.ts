import type {
  CapacityView,
  LocalDate,
  PlanningLaneId,
  PlanningSection,
  PlanningTask,
  ReorderGuard,
  SetTaskCompletedInput,
  SetTaskScheduledDateInput,
  UpdateTaskInput,
} from "./planner.ts";

export type CapacityPreview = {
  committedMinutes: number;
  message: string;
};

export type PlanningInteractionState = {
  activeTaskId: string | null;
  sourceLane: PlanningLaneId | null;
  overLane: PlanningLaneId | null;
  overTaskId: string | null;
  validOverTarget: boolean;
  capacityPreview: CapacityPreview | null;
};

type BoardContext = {
  lanes: PlanningInteractionLane[];
  today: LocalDate;
  capacity: CapacityView;
  canReorder: boolean;
};

type PlanningInteractionLane = {
  id: PlanningLaneId;
  reorder: PlanningSection["reorder"];
  tasks: PlanningTask[];
};

export type PlanningBoardEvent =
  | { type: "drag-start"; taskId: string }
  | { type: "drag-over"; lane: PlanningLaneId | null; taskId: string | null }
  | { type: "drag-cancel" }
  | { type: "drop"; lane: PlanningLaneId | null; taskId: string | null };

export type PlanningInteractionEffect =
  | { type: "reorder"; guard: ReorderGuard; lane: Exclude<PlanningLaneId, "done">; taskIds: string[] }
  | { type: "inspect"; taskId: string; feedback: { lane: PlanningLaneId; message: string } }
  | { type: "update-task"; input: UpdateTaskInput }
  | { type: "set-completed"; input: SetTaskCompletedInput }
  | { type: "set-scheduled-date"; input: SetTaskScheduledDateInput };

type BoardInteraction = {
  kind: "board";
  context: BoardContext;
  state: PlanningInteractionState;
  event: PlanningBoardEvent;
};

type LaneDraftInteraction = {
  kind: "lane-draft";
  task: PlanningTask;
  destination: PlanningLaneId;
  today: LocalDate;
  draft: {
    estimate: string;
    scheduledDate: LocalDate | null;
  };
};

type BoardInteractionResult = {
  kind: "board";
  state: PlanningInteractionState;
  effect: PlanningInteractionEffect | null;
};

type LaneDraftResult = {
  kind: "lane-draft";
  draft: LaneDraftInteraction["draft"];
};

export function idlePlanningInteraction(): PlanningInteractionState {
  return {
    activeTaskId: null,
    sourceLane: null,
    overLane: null,
    overTaskId: null,
    validOverTarget: false,
    capacityPreview: null,
  };
}

export function planningInteraction(
  input: BoardInteraction | LaneDraftInteraction,
): BoardInteractionResult | LaneDraftResult {
  if (input.kind === "lane-draft") {
    return {
      kind: "lane-draft",
      draft: transformLaneDraft(input),
    };
  }

  return transitionBoard(input);
}

function transitionBoard(input: BoardInteraction): BoardInteractionResult {
  const { context, event, state } = input;
  if (event.type === "drag-cancel") {
    return boardResult(idlePlanningInteraction());
  }

  if (event.type === "drag-start") {
    const sourceLane = laneContainingTask(context.lanes, event.taskId);
    if (!sourceLane || sourceLane === "done") return boardResult(idlePlanningInteraction());
    return boardResult({
      ...idlePlanningInteraction(),
      activeTaskId: event.taskId,
      sourceLane,
      overLane: sourceLane,
      validOverTarget: context.canReorder,
    });
  }

  const task = state.activeTaskId
    ? taskInLanes(context.lanes, state.activeTaskId)
    : undefined;
  if (!task || !state.sourceLane || state.sourceLane === "done") {
    return boardResult(idlePlanningInteraction());
  }

  if (event.type === "drag-over") {
    const validOverTarget = event.lane
      ? validDropTarget(task, state.sourceLane, event.lane, context.canReorder)
      : false;
    return boardResult({
      ...state,
      overLane: event.lane,
      overTaskId: event.taskId,
      validOverTarget,
      capacityPreview: event.lane
        ? previewCapacity(context.capacity, task, state.sourceLane, event.lane)
        : null,
    });
  }

  const idle = idlePlanningInteraction();
  if (!event.lane) return boardResult(idle);
  const effect = dropEffect(context, task, state.sourceLane, event.lane, event.taskId);
  return boardResult(idle, effect);
}

function dropEffect(
  context: BoardContext,
  task: PlanningTask,
  source: Exclude<PlanningLaneId, "done">,
  destination: PlanningLaneId,
  destinationTaskId: string | null,
): PlanningInteractionEffect | null {
  if (source === destination) {
    if (!context.canReorder || !destinationTaskId || destinationTaskId === task.id) return null;
    const lane = context.lanes.find((candidate) => candidate.id === source);
    if (!lane?.reorder) return null;
    const previousIndex = lane.tasks.findIndex((candidate) => candidate.id === task.id);
    const nextIndex = lane.tasks.findIndex((candidate) => candidate.id === destinationTaskId);
    if (previousIndex < 0 || nextIndex < 0) return null;
    return {
      type: "reorder",
      guard: lane.reorder,
      lane: source,
      taskIds: moveItem(lane.tasks.map((candidate) => candidate.id), previousIndex, nextIndex),
    };
  }

  if (destination === "ready" && task.estimateMinutes === null) {
    return {
      type: "inspect",
      taskId: task.id,
      feedback: { lane: "ready", message: "Add an estimate to make this task Ready." },
    };
  }
  if (destination === "done") {
    return {
      type: "set-completed",
      input: { id: task.id, completed: true, expectedRevision: task.revision },
    };
  }
  if (destination === "today") {
    return {
      type: "set-scheduled-date",
      input: {
        id: task.id,
        scheduledDate: context.today,
        expectedRevision: task.revision,
      },
    };
  }
  return {
    type: "update-task",
    input: {
      id: task.id,
      title: task.title,
      estimateMinutes: destination === "capture" ? null : task.estimateMinutes,
      scheduledDate: task.scheduledDate === context.today ? null : task.scheduledDate,
      anchorDate: task.anchorDate,
      expectedRevision: task.revision,
    },
  };
}

function transformLaneDraft(input: LaneDraftInteraction) {
  const { destination, draft, task, today } = input;
  if (task.completedAt || destination === "done") return draft;
  if (destination === "capture") {
    return {
      estimate: "",
      scheduledDate: draft.scheduledDate === today ? null : draft.scheduledDate,
    };
  }
  if (destination === "ready") {
    return {
      ...draft,
      scheduledDate: draft.scheduledDate === today ? null : draft.scheduledDate,
    };
  }
  return { ...draft, scheduledDate: today };
}

function boardResult(
  state: PlanningInteractionState,
  effect: PlanningInteractionEffect | null = null,
): BoardInteractionResult {
  return { kind: "board", state, effect };
}

function taskInLanes(lanes: PlanningInteractionLane[], taskId: string) {
  return lanes.flatMap((lane) => lane.tasks).find((task) => task.id === taskId);
}

function laneContainingTask(lanes: PlanningInteractionLane[], taskId: string) {
  return lanes.find((lane) => lane.tasks.some((task) => task.id === taskId))?.id ?? null;
}

function validDropTarget(
  task: PlanningTask,
  source: Exclude<PlanningLaneId, "done">,
  destination: PlanningLaneId,
  canReorder: boolean,
) {
  if (source === destination) return canReorder;
  if (destination === "ready") return task.estimateMinutes !== null;
  return true;
}

function previewCapacity(
  capacity: CapacityView,
  task: PlanningTask,
  source: Exclude<PlanningLaneId, "done">,
  destination: PlanningLaneId,
): CapacityPreview | null {
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

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function moveItem(items: string[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
