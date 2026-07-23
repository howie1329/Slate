import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MASKED_API_KEY,
  blurApiKey,
  buildSaveSettingsInput,
  changeApiKey,
  changeSettings,
  createSettingsDraft,
  focusApiKey,
  markApiKeyForRemoval,
  settingsDraftView,
} from "./settings-draft.ts";

const snapshot = {
  tasks: [],
  orderByScope: {},
  settings: {
    dailyCapacityMinutes: 240,
    planningInstruction: "",
    aiProvider: "openrouter",
    aiModel: "openai/gpt-5-mini",
    theme: "light",
  },
  aiAvailability: "configured",
  aiAvailabilityByProvider: {
    "vercel-gateway": "unconfigured",
    openrouter: "configured",
  },
  today: "2026-07-23",
};

describe("Settings draft", () => {
  it("shows a saved mask without becoming dirty when focus leaves empty", () => {
    const initial = createSettingsDraft(snapshot);
    assert.deepEqual(settingsDraftView(initial), {
      canSave: false,
      isDirty: false,
      keyDisplayValue: MASKED_API_KEY,
      keyStatus: "configured",
    });

    const focused = focusApiKey(initial);
    assert.equal(settingsDraftView(focused).keyDisplayValue, "");
    assert.equal(settingsDraftView(focused).isDirty, false);

    const blurred = blurApiKey(focused);
    assert.equal(settingsDraftView(blurred).keyDisplayValue, MASKED_API_KEY);
    assert.equal(settingsDraftView(blurred).isDirty, false);
  });

  it("treats typed key text as a replacement without submitting the mask", () => {
    const changed = blurApiKey(
      changeApiKey(focusApiKey(createSettingsDraft(snapshot)), "new-secret"),
    );

    assert.deepEqual(settingsDraftView(changed), {
      canSave: true,
      isDirty: true,
      keyDisplayValue: "new-secret",
      keyStatus: "replacement",
    });
    assert.deepEqual(buildSaveSettingsInput(changed).apiKeyChange, {
      kind: "replace",
      apiKey: "new-secret",
    });
    assert.deepEqual(buildSaveSettingsInput(createSettingsDraft(snapshot)).apiKeyChange, {
      kind: "unchanged",
    });
  });

  it("uses provider-specific key status without carrying transient key text", () => {
    const withReplacement = changeApiKey(createSettingsDraft(snapshot), "openrouter-secret");
    const gateway = changeSettings(withReplacement, { aiProvider: "vercel-gateway" });

    assert.equal(settingsDraftView(gateway).keyDisplayValue, "");
    assert.equal(settingsDraftView(gateway).keyStatus, "required");
    assert.deepEqual(buildSaveSettingsInput(gateway).apiKeyChange, { kind: "unchanged" });

    const openrouter = changeSettings(gateway, { aiProvider: "openrouter" });
    assert.equal(settingsDraftView(openrouter).keyDisplayValue, MASKED_API_KEY);
    assert.equal(settingsDraftView(openrouter).keyStatus, "configured");
  });

  it("defers key removal until the unified save", () => {
    const removal = markApiKeyForRemoval(createSettingsDraft(snapshot));

    assert.deepEqual(settingsDraftView(removal), {
      canSave: true,
      isDirty: true,
      keyDisplayValue: "",
      keyStatus: "remove-pending",
    });
    assert.deepEqual(buildSaveSettingsInput(removal).apiKeyChange, {
      kind: "remove",
    });
  });

  it("tracks ordinary settings changes and resets from a successful snapshot", () => {
    const changed = changeSettings(createSettingsDraft(snapshot), {
      aiModel: "google/gemini-2.5-flash",
    });
    assert.equal(settingsDraftView(changed).isDirty, true);
    assert.equal(
      buildSaveSettingsInput(changed).settings.aiModel,
      "google/gemini-2.5-flash",
    );

    const saved = createSettingsDraft({
      ...snapshot,
      settings: {
        ...snapshot.settings,
        aiModel: "google/gemini-2.5-flash",
      },
    });
    assert.equal(settingsDraftView(saved).isDirty, false);
    assert.equal(settingsDraftView(saved).keyDisplayValue, MASKED_API_KEY);
  });
});
