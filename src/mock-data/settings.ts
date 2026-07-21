import type { MockSettingsState } from "./types";

const mockSettings = {
  dailyCapacityMinutes: 240,
  planningInstruction:
    "Prioritize customer-facing work and leave room for unexpected requests.",
  aiProvider: "vercel-gateway",
  aiModel: "openai/gpt-5-mini",
} as const;

export const configuredMockSettings: MockSettingsState = {
  settings: mockSettings,
  aiAvailability: "configured",
};

export const unconfiguredMockSettings: MockSettingsState = {
  settings: mockSettings,
  aiAvailability: "unconfigured",
};
