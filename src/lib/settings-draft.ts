import type { AiProvider, PlannerSnapshot, SaveSettingsInput, Settings } from "./planner.ts";

export const MASKED_API_KEY = "••••••••••••";

export type KeyDraft =
  | { kind: "unchanged" }
  | { kind: "replace"; value: string }
  | { kind: "remove" };

export type SettingsDraft = {
  baseline: Settings;
  values: Settings;
  availabilityByProvider: PlannerSnapshot["aiAvailabilityByProvider"];
  key: KeyDraft;
  keyFocused: boolean;
};

export type SettingsDraftView = {
  canSave: boolean;
  isDirty: boolean;
  keyDisplayValue: string;
  keyStatus: "configured" | "required" | "replacement" | "remove-pending";
};

export function createSettingsDraft(snapshot: PlannerSnapshot): SettingsDraft {
  return {
    baseline: { ...snapshot.settings },
    values: { ...snapshot.settings },
    availabilityByProvider: { ...snapshot.aiAvailabilityByProvider },
    key: { kind: "unchanged" },
    keyFocused: false,
  };
}

export function focusApiKey(draft: SettingsDraft): SettingsDraft {
  return { ...draft, keyFocused: true };
}

export function blurApiKey(draft: SettingsDraft): SettingsDraft {
  return { ...draft, keyFocused: false };
}

export function changeApiKey(draft: SettingsDraft, value: string): SettingsDraft {
  return {
    ...draft,
    key: value ? { kind: "replace", value } : { kind: "unchanged" },
    keyFocused: true,
  };
}

export function changeSettings(
  draft: SettingsDraft,
  patch: Partial<Settings>,
): SettingsDraft {
  const providerChanged =
    patch.aiProvider !== undefined
    && patch.aiProvider !== draft.values.aiProvider;

  return {
    ...draft,
    values: { ...draft.values, ...patch },
    ...(providerChanged
      ? {
          key: { kind: "unchanged" as const },
          keyFocused: false,
        }
      : {}),
  };
}

export function markApiKeyForRemoval(draft: SettingsDraft): SettingsDraft {
  return {
    ...draft,
    key: { kind: "remove" },
    keyFocused: false,
  };
}

export function resetApiKeyChange(draft: SettingsDraft): SettingsDraft {
  return {
    ...draft,
    key: { kind: "unchanged" },
    keyFocused: false,
  };
}

export function buildSaveSettingsInput(draft: SettingsDraft): SaveSettingsInput {
  return {
    settings: { ...draft.values },
    apiKeyChange:
      draft.key.kind === "replace"
        ? { kind: "replace", apiKey: draft.key.value }
        : { kind: draft.key.kind },
  };
}

export function settingsDraftView(draft: SettingsDraft): SettingsDraftView {
  const configured = providerConfigured(draft, draft.values.aiProvider);
  const settingsChanged = !settingsEqual(draft.values, draft.baseline);
  const keyChanged = draft.key.kind !== "unchanged";
  const isDirty = settingsChanged || keyChanged;

  return {
    canSave: isDirty,
    isDirty,
    keyDisplayValue:
      draft.key.kind === "replace"
        ? draft.key.value
        : configured && !draft.keyFocused && draft.key.kind === "unchanged"
          ? MASKED_API_KEY
          : "",
    keyStatus:
      draft.key.kind === "remove"
        ? "remove-pending"
        : draft.key.kind === "replace"
          ? "replacement"
          : configured
            ? "configured"
            : "required",
  };
}

function providerConfigured(draft: SettingsDraft, provider: AiProvider) {
  return draft.availabilityByProvider[provider] === "configured";
}

function settingsEqual(first: Settings, second: Settings) {
  return (
    first.dailyCapacityMinutes === second.dailyCapacityMinutes
    && first.planningInstruction === second.planningInstruction
    && first.aiProvider === second.aiProvider
    && first.aiModel === second.aiModel
    && first.theme === second.theme
  );
}
