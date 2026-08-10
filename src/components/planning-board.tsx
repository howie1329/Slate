import { useMemo } from "react";
import {
  Calendar01Icon,
  Clock01Icon,
  InboxIcon,
  Sun01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTaskSelection } from "@/components/task-selection";
import { PlanningTaskSheet } from "@/components/planning-task-sheet";
import { cn } from "@/lib/utils";
import {
  planningBoardLanes,
  type PlanningBoardFilter,
  type PlanningBoardSort,
  type PlanningLaneId,
} from "@/lib/planning-board";
import type { PlannerSnapshot, PlanningTask } from "@/lib/planner";
import { formatDueDate } from "@/lib/local-date";

type PlanningBoardProps = {
  filter: PlanningBoardFilter;
  query: string;
  snapshot?: PlannerSnapshot;
  sort: PlanningBoardSort;
};

const laneIcons = {
  capture: InboxIcon,
  ready: Calendar01Icon,
  today: Sun01Icon,
  done: Tick02Icon,
} as const;

export function PlanningBoard({ filter, query, snapshot, sort }: PlanningBoardProps) {
  const lanes = useMemo(
    () => snapshot ? planningBoardLanes(snapshot, query, filter, sort) : [],
    [filter, query, snapshot, sort],
  );

  if (!snapshot) return <PlanningBoardLoading />;

  return (
    <section aria-label="Planning board" className="h-full min-h-0 overflow-x-auto overflow-y-hidden bg-background">
      <h1 className="sr-only">Planning board</h1>
      <div className="grid h-full min-w-[920px] grid-cols-4">
        {lanes.map((lane) => (
          <PlanningLane
            key={lane.id}
            capacity={lane.id === "today" ? snapshot.planning.today.capacity : undefined}
            id={lane.id}
            label={lane.label}
            tasks={lane.tasks}
          />
        ))}
      </div>
      <PlanningTaskSheet snapshot={snapshot} />
    </section>
  );
}

function PlanningLane({
  capacity,
  id,
  label,
  tasks,
}: {
  capacity?: PlannerSnapshot["planning"]["today"]["capacity"];
  id: PlanningLaneId;
  label: string;
  tasks: PlanningTask[];
}) {
  const Icon = laneIcons[id];
  const capacityPercent = capacity
    ? Math.min(100, Math.round((capacity.committedMinutes / Math.max(1, capacity.limitMinutes)) * 100))
    : 0;

  return (
    <section
      aria-labelledby={`planning-lane-${id}`}
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col border-r border-border last:border-r-0",
        id === "today" && "relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground",
      )}
      data-planning-lane={id}
    >
      <header className="flex min-h-[72px] shrink-0 flex-col justify-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon aria-hidden="true" icon={Icon} size={15} strokeWidth={1.7} />
          <h2 className="m-0 text-section font-semibold" id={`planning-lane-${id}`}>{label}</h2>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-estimate tabular-nums text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {capacity ? (
          <div className="flex items-center gap-2 text-capacity text-muted-foreground">
            <span className="shrink-0 font-mono tabular-nums">
              {formatMinutes(capacity.committedMinutes)} / {formatMinutes(capacity.limitMinutes)}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <span
                className={cn("block h-full rounded-full", capacity.isOverCapacity ? "bg-capacity-caution" : "bg-foreground")}
                style={{ width: `${capacityPercent}%` }}
              />
            </span>
            {capacity.isOverCapacity ? (
              <span className="shrink-0 text-capacity-caution">+{formatMinutes(capacity.overageMinutes)}</span>
            ) : null}
          </div>
        ) : (
          <p className="m-0 text-metadata text-muted-foreground">{laneDescription(id)}</p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {tasks.length ? (
          <div className="space-y-1.5">
            {tasks.map((task) => <PlanningBoardCard key={task.id} lane={id} task={task} />)}
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center px-4 text-center text-metadata leading-4 text-muted-foreground">
            {emptyLaneMessage(id)}
          </div>
        )}
      </div>
    </section>
  );
}

function PlanningBoardCard({ lane, task }: { lane: PlanningLaneId; task: PlanningTask }) {
  const { selectedTaskId, selectTask } = useTaskSelection();
  const selected = selectedTaskId === task.id;
  const metadata = taskMetadata(task, lane);

  return (
    <button
      aria-pressed={selected}
      className={cn(
        "group w-full rounded-md border border-border bg-card px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none",
        selected && "border-foreground bg-muted ring-1 ring-foreground",
        lane === "done" && "text-muted-foreground",
      )}
      data-task-row
      onClick={() => selectTask(task.id)}
      type="button"
    >
      <span className="flex min-w-0 items-start gap-2">
        {lane === "done" ? (
          <HugeiconsIcon aria-hidden="true" className="mt-px shrink-0" icon={Tick02Icon} size={13} strokeWidth={1.6} />
        ) : lane === "today" ? (
          <HugeiconsIcon aria-hidden="true" className="mt-px shrink-0 text-muted-foreground" icon={Clock01Icon} size={13} strokeWidth={1.6} />
        ) : null}
        <span className={cn("min-w-0 flex-1 truncate text-task font-medium text-foreground", lane === "done" && "text-muted-foreground")}>
          {task.title}
        </span>
        {task.estimateMinutes !== null ? (
          <span className="shrink-0 font-mono text-estimate tabular-nums text-muted-foreground">
            {formatMinutes(task.estimateMinutes)}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-metadata text-muted-foreground">
        {lane === "capture" ? <span className="font-medium text-foreground">Needs estimate</span> : null}
        {metadata.map((item, index) => (
          <span className="flex min-w-0 items-center gap-1" key={`${item}-${index}`}>
            {index > 0 || lane === "capture" ? <span aria-hidden="true">·</span> : null}
            <span className="truncate">{item}</span>
          </span>
        ))}
      </span>
    </button>
  );
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
  if (id === "capture") return "No unshaped tasks.";
  if (id === "ready") return "Nothing ready to commit.";
  if (id === "today") return "Today is still open.";
  return "Completed tasks will collect here.";
}

function PlanningBoardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading planning board" className="grid h-full min-w-[920px] grid-cols-4 overflow-hidden">
      {[0, 1, 2, 3].map((lane) => (
        <div className="border-r border-border p-3 last:border-r-0" key={lane}>
          <div className="mb-6 h-4 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          {[0, 1, 2, 3].map((card) => (
            <div className="mb-2 h-14 animate-pulse rounded-md border border-border bg-muted/60 motion-reduce:animate-none" key={card} />
          ))}
        </div>
      ))}
    </div>
  );
}
