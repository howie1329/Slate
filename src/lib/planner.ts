import { invoke } from "@tauri-apps/api/core";
import type { AiModel, AiProvider } from "./ai-catalog";

export type LocalDate = `${number}-${number}-${number}`;
export type Theme = "dark" | "light";
export type OnboardingStatus = "not-started" | "completed" | "skipped";
export type CapacityMode = "global" | "weekly";
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
export type { AiModel, AiProvider } from "./ai-catalog";
export type AiAvailability = "configured" | "unconfigured" | "unavailable";

export type Task = {
  id: string;
  title: string;
  estimateMinutes: number | null;
  scheduledDate: LocalDate | null;
  createdAt: string;
  completedAt: string | null;
  revision: number;
  anchorDate: LocalDate | null;
};

export type Settings = {
  dailyCapacityMinutes: number;
  planningInstruction: string;
  aiProvider: AiProvider;
  aiModel: AiModel;
  theme: Theme;
  onboardingStatus: OnboardingStatus;
  capacityMode: CapacityMode;
  weeklyCapacityMinutes: Record<Weekday, number>;
  quickCaptureEnabled: boolean;
  quickCaptureShortcut: string;
};

export type PlannerSnapshot = {
  tasks: Task[];
  orderByScope: Record<string, string[]>;
  settings: Settings;
  aiAvailability: AiAvailability;
  aiAvailabilityByProvider: Record<AiProvider, AiAvailability>;
  today: LocalDate;
  effectiveCapacityMinutes: number;
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

export type ApiKeyChange =
  | { kind: "unchanged" }
  | { kind: "replace"; apiKey: string }
  | { kind: "remove" };

export type SaveSettingsInput = {
  settings: Settings;
  apiKeyChange: ApiKeyChange;
  source: "settings" | "onboarding";
};

export type AiPlanItem = {
  id: string;
  title: string;
  estimateMinutes: number;
  sourceScheduledDate: LocalDate | null;
  scheduledDate: LocalDate;
  position: number;
  revision: number;
};

export type TaskRevision = { id: string; revision: number };

export type AiPlanProposal = {
  items: AiPlanItem[];
  totalMinutes: number;
  remainingMinutes: number;
  rationale: string | null;
  emptyReason: "no-capacity" | "no-eligible-tasks" | "no-fitting-plan" | null;
  todayTaskIds: string[];
  todayTaskRevisions: TaskRevision[];
  expectedDailyCapacityMinutes: number;
  expectedRemainingMinutes: number;
};

export type AiPlanAcceptanceInput = {
  items: Array<Pick<AiPlanItem, "id" | "title" | "estimateMinutes" | "sourceScheduledDate" | "revision">>;
  todayTaskIds: string[];
  todayTaskRevisions: TaskRevision[];
  expectedDailyCapacityMinutes: number;
  expectedRemainingMinutes: number;
};

export type TaskInput = {
  title: string;
  estimateMinutes: number | null;
  scheduledDate: LocalDate | null;
  source: "manual" | "ai-assist" | "onboarding" | "manual-quick-capture";
};

export type CreatedTask = { id: string; revision: number };
export type UndoQuickCaptureInput = { id: string; expectedRevision: number };
export type QuickCaptureDraft = { title: string; updatedAt: string };

export type UpdateTaskInput = Omit<TaskInput, "source"> & {
  id: string;
  anchorDate: LocalDate | null;
  expectedRevision: number;
};
export type SetTaskCompletedInput = { id: string; completed: boolean; expectedRevision: number };
export type SetTaskScheduledDateInput = {
  id: string;
  scheduledDate: LocalDate | null;
  expectedRevision: number;
};
export type DeleteTaskInput = { id: string; expectedRevision: number };
export type ReorderTasksInput = {
  scope: string;
  taskIds: string[];
  expectedRevisions: TaskRevision[];
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

export function getQuickCaptureShortcutError() {
  return plannerInvoke<string | null>("get_quick_capture_shortcut_error");
}

export function createTask(input: TaskInput) {
  return plannerInvoke<CreatedTask>("create_task", { input });
}

export function undoQuickCapture(input: UndoQuickCaptureInput) {
  return plannerInvoke<void>("undo_quick_capture", { input });
}

export function getQuickCaptureDraft() {
  return plannerInvoke<QuickCaptureDraft | null>("get_quick_capture_draft");
}

export function setQuickCaptureDraft(title: string) {
  return plannerInvoke<void>("set_quick_capture_draft", { title });
}

export function clearQuickCaptureDraft() {
  return plannerInvoke<void>("clear_quick_capture_draft");
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

export function deleteTask(input: DeleteTaskInput) {
  return plannerInvoke<void>("delete_task", { input });
}

export function reorderTasks(input: ReorderTasksInput) {
  return plannerInvoke<void>("reorder_tasks", { input });
}

export function saveSettings(input: SaveSettingsInput) {
  return plannerInvoke<PlannerSnapshot>("save_settings", { input });
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
