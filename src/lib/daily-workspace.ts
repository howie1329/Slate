import type {
  CapacityView,
  PlanningSection,
  PlanningTask,
  PlanningView,
  WorkspaceBadge,
} from "./planner";

export type DailyTaskMetadataTone = "muted" | "caution" | "destructive";

export type DailyTaskMetadata = {
  label: string;
  tone?: DailyTaskMetadataTone;
};

export type DailyTaskSection = {
  tasks: PlanningTask[];
  metadataByTaskId: Record<string, DailyTaskMetadata[]>;
};

export type DailyWorkspaceModel = {
  query: string;
  hasQuery: boolean;
  hasMatches: boolean;
  today: {
    active: DailyTaskSection;
    completed: DailyTaskSection;
    capacity: CapacityView;
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

export function filterDailyWorkspace(
  planning: PlanningView,
  query = "",
): DailyWorkspaceModel {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const todayActive = filterSection(planning.today.active, normalizedQuery);
  const todayCompleted = filterSection(planning.today.completed, normalizedQuery);
  const backlogActive = filterSection(planning.backlog.active, normalizedQuery);
  const backlogCompleted = filterSection(planning.backlog.completed, normalizedQuery);

  return {
    query: query.trim(),
    hasQuery: normalizedQuery.length > 0,
    hasMatches:
      todayActive.tasks.length
        + todayCompleted.tasks.length
        + backlogActive.tasks.length
        + backlogCompleted.tasks.length
      > 0,
    today: {
      active: todayActive,
      completed: todayCompleted,
      capacity: planning.today.capacity,
      totalTaskCount: planning.today.totalTaskCount,
      unsizedTaskCount: planning.today.unsizedTaskCount,
    },
    backlog: {
      active: backlogActive,
      completed: backlogCompleted,
      totalTaskCount: planning.backlog.totalTaskCount,
      activeTaskCount: planning.backlog.activeTaskCount,
    },
  };
}

function filterSection(
  section: PlanningSection,
  normalizedQuery: string,
): DailyTaskSection {
  const tasks = normalizedQuery
    ? section.tasks.filter((task) => task.title.toLocaleLowerCase().includes(normalizedQuery))
    : section.tasks;

  return {
    tasks,
    metadataByTaskId: Object.fromEntries(
      tasks.map((task) => [task.id, task.badges.map(metadataForBadge)]),
    ),
  };
}

function metadataForBadge(badge: WorkspaceBadge): DailyTaskMetadata {
  switch (badge) {
    case "needs-estimate":
      return { label: "Needs estimate", tone: "caution" };
    case "overdue":
      return { label: "Overdue", tone: "destructive" };
    case "upcoming":
      return { label: "Upcoming" };
    case "unscheduled":
      return { label: "Unscheduled" };
  }
}
