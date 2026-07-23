import { invoke } from "@tauri-apps/api/core";

export type LocalDate = `${number}-${number}-${number}`;
export type Theme = "dark" | "light";
export type AiProvider = "vercel-gateway" | "openrouter";

export type Task = {
  id: string;
  title: string;
  estimateMinutes: number | null;
  scheduledDate: LocalDate | null;
  createdAt: string;
  completedAt: string | null;
};

export type Settings = {
  dailyCapacityMinutes: number;
  planningInstruction: string;
  aiProvider: AiProvider;
  aiModel: string;
  theme: Theme;
};

export type PlannerSnapshot = {
  tasks: Task[];
  orderByScope: Record<string, string[]>;
  settings: Settings;
  aiAvailability: "configured" | "unconfigured";
  today: LocalDate;
};

export type AiAssistInput = {
  capture: string;
  scheduledDate: LocalDate | null;
};

export type AiAssistProposal = {
  title: string;
  estimateMinutes: number;
  scheduledDate: LocalDate | null;
};

export type AiPlanItem = {
  id: string;
  title: string;
  estimateMinutes: number;
  sourceScheduledDate: LocalDate | null;
  scheduledDate: LocalDate;
  position: number;
};

export type AiPlanProposal = {
  items: AiPlanItem[];
  totalMinutes: number;
  remainingMinutes: number;
  rationale: string | null;
  emptyReason: "no-capacity" | "no-eligible-tasks" | "no-fitting-plan" | null;
  todayTaskIds: string[];
  expectedDailyCapacityMinutes: number;
  expectedRemainingMinutes: number;
};

export type AiPlanAcceptanceInput = {
  items: Array<Pick<AiPlanItem, "id" | "title" | "estimateMinutes" | "sourceScheduledDate">>;
  todayTaskIds: string[];
  expectedDailyCapacityMinutes: number;
  expectedRemainingMinutes: number;
};

export type TaskInput = {
  title: string;
  estimateMinutes: number | null;
  scheduledDate: LocalDate | null;
};

export type UpdateTaskInput = TaskInput & { id: string };
export type SetTaskCompletedInput = { id: string; completed: boolean };
export type SetTaskScheduledDateInput = { id: string; scheduledDate: LocalDate | null };
export type ReorderTasksInput = { scope: string; taskIds: string[] };
export type PlannerPlanAssignment = {
  taskId: string;
  scheduledDate: LocalDate;
  scope: string;
  position: number;
};

export function isTauriWindow() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function plannerInvoke<T>(command: string, payload?: Record<string, unknown>) {
  if (!isTauriWindow()) {
    return Promise.reject(new Error("Slate persistence is available in the desktop app only."));
  }

  return invoke<T>(command, payload);
}

export function getPlannerSnapshot() {
  return plannerInvoke<PlannerSnapshot>("get_planner_snapshot");
}

export function retryPersistence() {
  return plannerInvoke<void>("retry_persistence");
}

export function createTask(input: TaskInput) {
  return plannerInvoke<void>("create_task", { input });
}

export function updateTask(input: UpdateTaskInput) {
  return plannerInvoke<void>("update_task", { input });
}

export function setTaskCompleted(input: SetTaskCompletedInput) {
  return plannerInvoke<void>("set_task_completed", { input });
}

export function setTaskScheduledDate(input: SetTaskScheduledDateInput) {
  return plannerInvoke<void>("set_task_scheduled_date", { input });
}

export function deleteTask(id: string) {
  return plannerInvoke<void>("delete_task", { id });
}

export function reorderTasks(input: ReorderTasksInput) {
  return plannerInvoke<void>("reorder_tasks", { input });
}

export function updateSettings(input: Settings) {
  return plannerInvoke<void>("update_settings", { input });
}

export function applyPlannerPlan(assignments: PlannerPlanAssignment[]) {
  return plannerInvoke<void>("apply_planner_plan", { input: { assignments } });
}

export function setApiKey(provider: AiProvider, apiKey: string) {
  return plannerInvoke<void>("set_api_key", { input: { provider, apiKey } });
}

export function deleteApiKey(provider: AiProvider) {
  return plannerInvoke<void>("delete_api_key", { input: { provider } });
}

export function generateAiAssist(input: AiAssistInput) {
  return plannerInvoke<AiAssistProposal>("generate_ai_assist", { input });
}

export function generateDailyPlan() {
  return plannerInvoke<AiPlanProposal>("generate_daily_plan");
}

export function acceptDailyPlan(input: AiPlanAcceptanceInput) {
  return plannerInvoke<void>("accept_daily_plan", { input });
}
