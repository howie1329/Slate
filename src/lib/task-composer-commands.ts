export type TaskComposerSchedule = "today" | "tomorrow" | "backlog";
export type TaskComposerLocalDate = `${number}-${number}-${number}`;

export type TaskComposerCommand = {
  kind: TaskComposerSchedule | "estimate";
  label: string;
};

export type TaskComposerCommandParse = {
  commands: TaskComposerCommand[];
  error: string | null;
  estimateMinutes: number | null;
  schedule: TaskComposerSchedule | null;
  title: string;
};

const validEstimateCommand = /^\/(\d+)m$/;
const malformedEstimateCommand = /^\/(?:[+-]?\d+(?:\.\d+)?|\.\d+)m$/;

export function parseTaskComposerCommands(value: string): TaskComposerCommandParse {
  const commands: TaskComposerCommand[] = [];
  const schedules: TaskComposerSchedule[] = [];
  const estimates: number[] = [];
  const titleParts: string[] = [];
  let hasMalformedEstimate = false;

  for (const part of value.trim().split(/\s+/)) {
    if (!part) {
      continue;
    }

    if (part === "/today" || part === "/tomorrow" || part === "/backlog") {
      const schedule = part.slice(1) as TaskComposerSchedule;
      schedules.push(schedule);
      commands.push({ kind: schedule, label: scheduleLabel(schedule) });
      continue;
    }

    const estimateMatch = part.match(validEstimateCommand);
    if (estimateMatch) {
      const estimateMinutes = Number(estimateMatch[1]);
      if (Number.isSafeInteger(estimateMinutes) && estimateMinutes > 0) {
        estimates.push(estimateMinutes);
        commands.push({ kind: "estimate", label: `${estimateMinutes}m` });
        continue;
      }
      hasMalformedEstimate = true;
      titleParts.push(part);
      continue;
    }

    if (malformedEstimateCommand.test(part)) {
      hasMalformedEstimate = true;
    }
    titleParts.push(part);
  }

  const title = titleParts.join(" ");
  const schedule = schedules[0] ?? null;
  const estimateMinutes = estimates[0] ?? null;

  return {
    commands,
    error: getParseError({
      hasMalformedEstimate,
      estimateCount: estimates.length,
      scheduleCount: schedules.length,
      schedule,
      title,
    }),
    estimateMinutes,
    schedule,
    title,
  };
}

export function buildTaskComposerInput(
  parsed: TaskComposerCommandParse,
  defaults: { scheduledDate: TaskComposerLocalDate | null; today: TaskComposerLocalDate },
): { estimateMinutes: number | null; scheduledDate: TaskComposerLocalDate | null; title: string } | null {
  if (parsed.error || !parsed.title) {
    return null;
  }

  return {
    estimateMinutes: parsed.estimateMinutes,
    scheduledDate: scheduledDateForCommand(parsed.schedule, defaults),
    title: parsed.title,
  };
}

function getParseError({
  hasMalformedEstimate,
  estimateCount,
  scheduleCount,
  schedule,
  title,
}: {
  hasMalformedEstimate: boolean;
  estimateCount: number;
  scheduleCount: number;
  schedule: TaskComposerSchedule | null;
  title: string;
}) {
  if (hasMalformedEstimate) {
    return "Use a positive whole-minute estimate, like /30m.";
  }
  if (scheduleCount > 1) {
    return "Choose only one schedule command: /today, /tomorrow, or /backlog.";
  }
  if (estimateCount > 1) {
    return "Use only one estimate command.";
  }
  if (!title) {
    return "Add a task title before saving.";
  }
  if (schedule === "today" && estimateCount === 0) {
    return "Add an estimate like /30m before committing this to Today.";
  }

  return null;
}

function scheduledDateForCommand(
  schedule: TaskComposerSchedule | null,
  defaults: { scheduledDate: TaskComposerLocalDate | null; today: TaskComposerLocalDate },
) {
  if (schedule === "today") {
    return defaults.today;
  }
  if (schedule === "tomorrow") {
    return tomorrowFrom(defaults.today);
  }
  if (schedule === "backlog") {
    return null;
  }
  return defaults.scheduledDate;
}

function scheduleLabel(schedule: TaskComposerSchedule) {
  if (schedule === "today") {
    return "Today";
  }
  if (schedule === "tomorrow") {
    return "Tomorrow";
  }
  return "Backlog";
}

function tomorrowFrom(today: TaskComposerLocalDate): TaskComposerLocalDate {
  const [year, month, day] = today.split("-").map(Number);
  const tomorrow = new Date(year, month - 1, day + 1);
  const tomorrowYear = tomorrow.getFullYear();
  const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const tomorrowDay = String(tomorrow.getDate()).padStart(2, "0");
  return `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}` as TaskComposerLocalDate;
}
