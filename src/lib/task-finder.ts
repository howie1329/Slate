import {
  PLANNING_LANES,
  type LocalDate,
  type PlannerSnapshot,
  type PlanningLaneId,
  type WorkspaceBadge,
} from "./planner.ts";

export type TaskFinderResult = {
  id: string;
  title: string;
  lane: PlanningLaneId;
  estimateMinutes: number | null;
  scheduledDate: LocalDate | null;
  completedAt: string | null;
  revision: number;
  anchorDate: LocalDate | null;
  badges: WorkspaceBadge[];
};

export type TaskFinderTitlePart = {
  text: string;
  matched: boolean;
};

export function taskFinderQueryTokens(query: string) {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

export function taskFinderResults(
  snapshot: PlannerSnapshot,
  query: string,
  includeAllWhenEmpty = false,
): TaskFinderResult[] {
  const tokens = taskFinderQueryTokens(query);
  if (tokens.length === 0 && !includeAllWhenEmpty) return [];

  return PLANNING_LANES.flatMap((lane) => (
    snapshot.planning.lanes[lane].tasks.flatMap((task) => {
      const normalizedTitle = task.title.toLocaleLowerCase();
      if (tokens.length > 0 && !tokens.every((token) => normalizedTitle.includes(token))) return [];

      return [{
        id: task.id,
        title: task.title,
        lane,
        estimateMinutes: task.estimateMinutes,
        scheduledDate: task.scheduledDate,
        completedAt: task.completedAt,
        revision: task.revision,
        anchorDate: task.anchorDate,
        badges: task.badges,
      }];
    })
  ));
}

export function taskFinderTitleParts(title: string, query: string): TaskFinderTitlePart[] {
  const tokens = [...new Set(taskFinderQueryTokens(query))];
  if (tokens.length === 0) return [{ text: title, matched: false }];

  const normalizedTitle = title.toLocaleLowerCase();
  const matchedCharacters = Array.from({ length: title.length }, () => false);

  for (const token of tokens) {
    let start = normalizedTitle.indexOf(token);
    while (start >= 0) {
      for (let index = start; index < start + token.length; index += 1) {
        matchedCharacters[index] = true;
      }
      start = normalizedTitle.indexOf(token, start + token.length);
    }
  }

  const parts: TaskFinderTitlePart[] = [];
  let start = 0;
  for (let index = 1; index <= title.length; index += 1) {
    if (index === title.length || matchedCharacters[index] !== matchedCharacters[start]) {
      parts.push({ text: title.slice(start, index), matched: matchedCharacters[start] });
      start = index;
    }
  }
  return parts;
}
