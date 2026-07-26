import type { OnboardingStatus, SaveSettingsInput, Settings } from "./planner";

export type OnboardingStep = "welcome" | "capacity" | "capture" | "commit" | "complete";

export function buildOnboardingSettingsInput(
  settings: Settings,
  patch: Partial<Pick<Settings, "dailyCapacityMinutes" | "onboardingStatus">>,
): SaveSettingsInput {
  return {
    settings: { ...settings, ...patch },
    apiKeyChange: { kind: "unchanged" },
  };
}

export function shouldOfferOnboarding(
  onboardingStatus: OnboardingStatus,
  taskCount: number,
) {
  return onboardingStatus === "not-started" && taskCount === 0;
}
