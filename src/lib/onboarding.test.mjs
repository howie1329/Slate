import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOnboardingSettingsInput, shouldOfferOnboarding } from "./onboarding.ts";

const settings = {
  dailyCapacityMinutes: 240,
  planningInstruction: "",
  aiProvider: "openrouter",
  aiModel: "openai/gpt-5-mini",
  theme: "light",
  onboardingStatus: "not-started",
  capacityMode: "global",
  weeklyCapacityMinutes: {
    monday: 240,
    tuesday: 240,
    wednesday: 240,
    thursday: 240,
    friday: 240,
    saturday: 240,
    sunday: 240,
  },
  quickCaptureEnabled: true,
  quickCaptureShortcut: "CommandOrControl+Shift+Space",
};

describe("Onboarding helpers", () => {
  it("offers onboarding only for a fresh, not-started planner", () => {
    assert.equal(shouldOfferOnboarding("not-started", 0), true);
    assert.equal(shouldOfferOnboarding("not-started", 1), false);
    assert.equal(shouldOfferOnboarding("completed", 0), false);
    assert.equal(shouldOfferOnboarding("skipped", 0), false);
  });

  it("builds a complete settings save without touching credentials", () => {
    assert.deepEqual(
      buildOnboardingSettingsInput(settings, {
        dailyCapacityMinutes: 300,
        onboardingStatus: "completed",
      }),
      {
        settings: {
          ...settings,
          dailyCapacityMinutes: 300,
          onboardingStatus: "completed",
        },
        apiKeyChange: { kind: "unchanged" },
        source: "onboarding",
      },
    );
  });
});
