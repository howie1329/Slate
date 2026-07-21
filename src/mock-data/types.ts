export type LocalDate = `${number}-${number}-${number}`;

export type Task = {
  id: string;
  title: string;
  estimateMinutes: number | null;
  scheduledDate: LocalDate | null;
  sortOrder: number;
  createdAt: string;
  completedAt: string | null;
};

export type AiProvider = "vercel-gateway" | "openrouter";

export type Settings = {
  dailyCapacityMinutes: number;
  planningInstruction: string;
  aiProvider: AiProvider;
  aiModel: string;
};

export type AiAvailability = "configured" | "unconfigured";

export type MockSettingsState = {
  settings: Settings;
  aiAvailability: AiAvailability;
};
