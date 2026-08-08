import type { LocalDate, PlannerSnapshot, Task } from "./planner";
import {
  calculateCapacityState,
  orderCompletedTasks,
  orderTasks,
  type CapacityState,
} from "./task-groups.ts";

export type DailyTaskMetadataTone = "muted" | "caution" | "destructive";

export type DailyTaskMetadata = {
  label: string;
  tone?: DailyTaskMetadataTone;
};

export type DailyTaskSection = {
  tasks: Task[];
  metadataByTaskId: Record<string, DailyTaskMetadata[]>;
};

export type DailyWorkspaceModel = {
  query: string;
  hasQuery: boolean;
  hasMatches: boolean;
  today: {
    active: DailyTaskSection;
    completed: DailyTaskSection;
    capacity: CapacityState;
    totalTaskCount: number;
    unsizedTaskCount: number;
  };
  backlog: {
    active: DailyTaskSection;
    completed: DailyTaskSection;
    totalTaskCount: number;
    activeTaskCount: number;
  };
};

const backlogScopes = [
  "log:needs-estimate",
  "log:overdue",
  "log:upcoming",
  "log:unscheduled",
] as const;

export function selectDailyWorkspace(planner: PlannerSnapshot, query = ""): DailyWorkspaceModel {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const todayTasks = planner.tasks.filter((task) => task.scheduledDate === planner.today);
  const todayScope = `today:${planner.today}`;
  const todayActiveAll = orderTasks(
    todayTasks.filter((task) => task.completedAt === null),
    planner.orderByScope,
    todayScope,
  );
  const todayCompletedAll = orderCompletedTasks(
    todayTasks.filter((task) => task.completedAt !== null),
  );
  const backlogActiveAll = backlogScopes.flatMap((scope) =>
    orderTasks(
      planner.tasks.filter(
        (task) =>
          task.completedAt === null &&
          task.scheduledDate !== planner.today &&
          backlogScopeForTask(task, planner.today) === scope,
      ),
      planner.orderByScope,
      scope,
    ),
  );
  const backlogCompletedAll = orderCompletedTasks(
    planner.tasks.filter(
      (task) => task.completedAt !== null && task.scheduledDate !== planner.today,
    ),
  );

  const todayActive = filterSection(todayActiveAll, normalizedQuery, planner.today, "today");
  const todayCompleted = filterSection(todayCompletedAll, normalizedQuery, planner.today, "completed");
  const backlogActive = filterSection(backlogActiveAll, normalizedQuery, planner.today, "backlog");
  const backlogCompleted = filterSection(backlogCompletedAll, normalizedQuery, planner.today, "completed");
  const capacity = calculateCapacityState(todayActiveAll, planner.effectiveCapacityMinutes);
  const unsizedTaskCount = todayActiveAll.filter((task) => task.estimateMinutes === null).length;

  return {
    query: query.trim(),
    hasQuery: normalizedQuery.length > 0,
    hasMatches:
      todayActive.tasks.length +
        todayCompleted.tasks.length +
        backlogActive.tasks.length +
        backlogCompleted.tasks.length >
      0,
    today: {
      active: todayActive,
      completed: todayCompleted,
      capacity,
      totalTaskCount: todayActiveAll.length + todayCompletedAll.length,
      unsizedTaskCount,
    },
    backlog: {
      active: backlogActive,
      completed: backlogCompleted,
      totalTaskCount: backlogActiveAll.length + backlogCompletedAll.length,
      activeTaskCount: backlogActiveAll.length,
    },
  };
}

function filterSection(
  tasks: Task[],
  normalizedQuery: string,
  today: LocalDate,
  section: "today" | "backlog" | "completed",
): DailyTaskSection {
  const visibleTasks = normalizedQuery
    ? tasks.filter((task) => task.title.toLocaleLowerCase().includes(normalizedQuery))
    : tasks;

  return {
    tasks: visibleTasks,
    metadataByTaskId: Object.fromEntries(
      visibleTasks.map((task) => [task.id, metadataForTask(task, today, section)]),
    ),
  };
}

function metadataForTask(
  task: Task,
  today: LocalDate,
  section: "today" | "backlog" | "completed",
): DailyTaskMetadata[] {
  if (section === "completed") {
    return [];
  }

  const metadata: DailyTaskMetadata[] = [];

  if (task.estimateMinutes === null) {
    metadata.push({ label: "Needs estimate", tone: "caution" });
  }

  if (section === "backlog") {
    if (task.scheduledDate === null) {
      metadata.push({ label: "Unscheduled" });
    } else if (task.scheduledDate < today) {
      metadata.push({ label: "Overdue", tone: "destructive" });
    } else if (task.scheduledDate > today) {
      metadata.push({ label: "Upcoming" });
    }
  }

  return metadata;
}

function backlogScopeForTask(task: Task, today: LocalDate) {
  if (task.estimateMinutes === null) {
    return "log:needs-estimate";
  }

  if (task.scheduledDate === null) {
    return "log:unscheduled";
  }

  return task.scheduledDate < today ? "log:overdue" : "log:upcoming";
}
