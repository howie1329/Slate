import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import appPackage from "../../package.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useRouteMotion } from "@/components/route-motion";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WEEKDAYS, type Settings, type Weekday } from "@/lib/planner";
import { getQuickCaptureShortcutError, isTauriWindow } from "@/lib/planner";
import {
  formatShortcut,
  RECOMMENDED_QUICK_CAPTURE_SHORTCUT,
  shortcutFromKeyboardEvent,
} from "@/lib/quick-capture";
import { AI_MODELS, AI_PROVIDERS, isAiModel, isAiProvider } from "@/lib/ai-catalog";
import {
  blurApiKey,
  buildSaveSettingsInput,
  changeApiKey,
  changeSettings,
  createSettingsDraft,
  focusApiKey,
  markApiKeyForRemoval,
  resetApiKeyChange,
  settingsDraftView,
  type SettingsDraft,
} from "@/lib/settings-draft";
import { usePlannerState, useSaveSettings } from "@/lib/planner-query";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const APP_VERSION = appPackage.version;
const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function SettingsPage() {
  const planner = usePlannerState();
  const saveSettings = useSaveSettings();
  const { setRouteTransition } = useRouteMotion();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  useEffect(() => {
    if (!planner.data) {
      return;
    }

    setDraft((current) =>
      current && settingsDraftView(current).isDirty
        ? current
        : createSettingsDraft(planner.data),
    );
  }, [planner.data]);

  useEffect(() => {
    if (!isTauriWindow()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listen<string>("quick-capture://registration-error", (event) => {
      setShortcutError(formatShortcutError(event.payload));
    }).then((stopListening) => {
      if (disposed) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    });
    void getQuickCaptureShortcutError()
      .then((error) => {
        if (error) {
          setShortcutError(formatShortcutError(error));
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!draft || !planner.data) {
    return null;
  }

  const view = settingsDraftView(draft);
  const keyConfigured =
    draft.availabilityByProvider[draft.values.aiProvider] === "configured";
  const keyUnavailable =
    draft.availabilityByProvider[draft.values.aiProvider] === "unavailable";
  const keyRequired = !keyConfigured && !keyUnavailable && draft.key.kind !== "remove";
  const keyRemovalPending = draft.key.kind === "remove";

  function updateDraft(patch: Partial<Settings>) {
    setDraft((current) => (current ? changeSettings(current, patch) : current));
  }

  function handleSaveSettings() {
    if (!draft || !view.canSave) {
      return;
    }

    saveSettings.mutate(buildSaveSettingsInput(draft), {
      onSuccess: (snapshot) => {
        setDraft(createSettingsDraft(snapshot));
        setShortcutError(null);
        toast.success("Settings saved.");
      },
      onError: (error) => {
        const message =
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "Could not save settings.";
        toast.error(message);
      },
    });
  }

  function handleBackToWorkspace(event: MouseEvent<HTMLAnchorElement>) {
    setRouteTransition(event.detail > 0 ? "animate" : "instant");
  }

  return (
    <section aria-labelledby="settings-heading" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-4 pt-3 sm:px-6">
        <div className="mx-auto flex h-10 w-full max-w-xl items-center">
          <Link
            aria-label="Back to Daily workspace"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-foreground no-underline outline-none transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            onClick={handleBackToWorkspace}
            to="/"
          >
            <HugeiconsIcon aria-hidden="true" icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            <span id="settings-heading">Settings</span>
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-xl space-y-4">
          <SettingsGroup description="Used for planning your day." title="Daily capacity">
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="capacity-mode">
              <span>Schedule</span>
              <Select
                onValueChange={(value) => {
                  if (value === "global" || value === "weekly") {
                    updateDraft({ capacityMode: value });
                  }
                }}
                value={draft.values.capacityMode}
              >
                <SelectTrigger aria-label="Capacity schedule" className="w-40 text-xs font-normal" id="capacity-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="global">Same every day</SelectItem>
                    <SelectItem value="weekly">By weekday</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            {draft.values.capacityMode === "global" ? (
              <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="daily-capacity">
                <span>Daily capacity</span>
                <InputGroup className="w-32">
                  <InputGroupInput
                    className="text-right tabular-nums"
                    id="daily-capacity"
                    min="1"
                    onChange={(event) => updateDraft({ dailyCapacityMinutes: Number(event.target.value) })}
                    type="number"
                    value={draft.values.dailyCapacityMinutes}
                  />
                  <InputGroupAddon>minutes</InputGroupAddon>
                </InputGroup>
              </label>
            ) : (
              <div aria-label="Weekly capacity" className="space-y-2">
                {WEEKDAYS.map((weekday) => (
                  <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor={`capacity-${weekday}`} key={weekday}>
                    <span>{WEEKDAY_LABELS[weekday]}</span>
                    <InputGroup className="w-32">
                      <InputGroupInput
                        aria-label={`${WEEKDAY_LABELS[weekday]} capacity`}
                        className="text-right tabular-nums"
                        id={`capacity-${weekday}`}
                        min="0"
                        onChange={(event) => updateDraft({
                          weeklyCapacityMinutes: {
                            ...draft.values.weeklyCapacityMinutes,
                            [weekday]: Number(event.target.value),
                          },
                        })}
                        type="number"
                        value={draft.values.weeklyCapacityMinutes[weekday]}
                      />
                      <InputGroupAddon>minutes</InputGroupAddon>
                    </InputGroup>
                  </label>
                ))}
              </div>
            )}
          </SettingsGroup>

          <SettingsGroup description="Capture a thought from anywhere into Backlog." title="Quick capture">
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="quick-capture-enabled">
              <span>
                <span className="block">Enable shortcut</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Creates an unestimated Backlog task.</span>
              </span>
              <button
                aria-label="Enable quick capture shortcut"
                id="quick-capture-enabled"
                aria-checked={draft.values.quickCaptureEnabled}
                className="inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-muted p-0.5 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked=true]:border-primary data-[checked=true]:bg-primary motion-reduce:transition-none"
                data-checked={draft.values.quickCaptureEnabled}
                onClick={() => updateDraft({ quickCaptureEnabled: !draft.values.quickCaptureEnabled })}
                role="switch"
                type="button"
              >
                <span className={`size-3.5 rounded-full bg-background shadow-sm transition-transform motion-reduce:transition-none ${draft.values.quickCaptureEnabled ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </label>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-menu font-medium">
                <span id="quick-capture-shortcut-label">Shortcut</span>
                <Button
                  aria-describedby="quick-capture-shortcut-label"
                  aria-label={isRecordingShortcut ? "Press a shortcut" : `Current shortcut ${formatShortcut(draft.values.quickCaptureShortcut)}`}
                  className={`min-w-32 font-mono text-xs ${isRecordingShortcut ? "border-primary bg-primary/10 text-foreground" : ""}`}
                  onBlur={() => setIsRecordingShortcut(false)}
                  onClick={() => setIsRecordingShortcut(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setIsRecordingShortcut(false);
                      return;
                    }
                    if (!isRecordingShortcut) {
                      return;
                    }
                    const shortcut = shortcutFromKeyboardEvent(event.nativeEvent);
                    if (shortcut) {
                      event.preventDefault();
                      updateDraft({ quickCaptureShortcut: shortcut });
                      setShortcutError(null);
                      setIsRecordingShortcut(false);
                    }
                  }}
                  type="button"
                  variant="outline"
                >
                  {isRecordingShortcut ? "Press keys…" : formatShortcut(draft.values.quickCaptureShortcut)}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className={`m-0 text-xs ${shortcutError ? "text-destructive" : "text-muted-foreground"}`} role={shortcutError ? "alert" : undefined}>
                  {shortcutError ?? "Use a modifier and one key."}
                </p>
                <Button
                  onClick={() => {
                    updateDraft({ quickCaptureShortcut: RECOMMENDED_QUICK_CAPTURE_SHORTCUT });
                    setShortcutError(null);
                  }}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Reset
                </Button>
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup description="Your key is stored securely in the macOS Keychain." title="AI connection">
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="ai-provider">
              <span>Provider</span>
              <Select
                onValueChange={(value) => {
                  if (value && isAiProvider(value)) {
                    updateDraft({ aiProvider: value });
                  }
                }}
                value={draft.values.aiProvider}
              >
                <SelectTrigger aria-label="AI provider" className="w-40 text-xs font-normal" id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AI_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="ai-model">
              <span>Model</span>
              <Select
                onValueChange={(value) => {
                  if (value && isAiModel(value)) {
                    updateDraft({ aiModel: value });
                  }
                }}
                value={draft.values.aiModel}
              >
                <SelectTrigger aria-label="AI model" className="w-40 text-xs font-normal" id="ai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AI_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <div
              className={`flex items-center justify-between gap-4 text-menu font-medium ${
                keyRequired || keyRemovalPending ? "border-b border-destructive/60 pb-1" : ""
              }`}
            >
              <label
                className={keyRequired || keyRemovalPending ? "text-destructive" : undefined}
                htmlFor="api-key"
              >
                API key
              </label>
              <Input
                aria-invalid={keyRequired || keyRemovalPending}
                aria-label={keyConfigured ? "API key configured. Enter a new key to replace it." : "API key"}
                autoComplete="off"
                className="h-8 w-40 tracking-[0.08em]"
                id="api-key"
                onBlur={() => setDraft((current) => (current ? blurApiKey(current) : current))}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) =>
                    current ? changeApiKey(current, value) : current,
                  );
                }}
                onFocus={() => setDraft((current) => (current ? focusApiKey(current) : current))}
                placeholder={keyConfigured ? undefined : "Paste key"}
                type="password"
                value={view.keyDisplayValue}
              />
            </div>
            <div className="flex min-h-6 items-center justify-between gap-3">
              <KeyStatus
                configured={keyConfigured}
                unavailable={keyUnavailable}
                removalPending={keyRemovalPending}
              />
              {keyRemovalPending ? (
                <Button
                  onClick={() =>
                    setDraft((current) => (current ? resetApiKeyChange(current) : current))
                  }
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Keep key
                </Button>
              ) : keyConfigured ? (
                <Button
                  onClick={() =>
                    setDraft((current) =>
                      current ? markApiKeyForRemoval(current) : current,
                    )
                  }
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Remove key
                </Button>
              ) : null}
            </div>
          </SettingsGroup>

          <SettingsGroup description="Guides how Slate plans your day." title="Planning instruction">
            <label className="sr-only" htmlFor="planning-instruction">
              Planning instruction
            </label>
            <Textarea
              className="min-h-20 resize-none text-menu leading-5"
              id="planning-instruction"
              maxLength={2000}
              onChange={(event) => updateDraft({ planningInstruction: event.target.value })}
              value={draft.values.planningInstruction}
            />
          </SettingsGroup>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex h-8 w-full max-w-xl items-center justify-between gap-3">
          <p className="m-0 text-xs text-muted-foreground">
            Stored locally on this Mac. <span aria-label={`Slate version ${APP_VERSION}`}>Slate v{APP_VERSION}</span>
          </p>
          <Button
            aria-label={saveSettings.isPending ? "Saving settings" : "Save changes"}
            disabled={!view.canSave || saveSettings.isPending}
            onClick={handleSaveSettings}
            size="sm"
            type="button"
          >
            {saveSettings.isPending ? (
              <HugeiconsIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
                data-icon="inline-start"
                icon={Loading03Icon}
                strokeWidth={2}
              />
            ) : null}
            {saveSettings.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </footer>
    </section>
  );
}

type SettingsGroupProps = {
  children: ReactNode;
  description: string;
  title: string;
};

function SettingsGroup({ children, description, title }: SettingsGroupProps) {
  const headingId = `${title.toLowerCase().replace(/ /g, "-")}-heading`;

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-muted/30 px-3 py-3">
      <h2 className="m-0 text-menu-label font-semibold text-foreground" id={headingId}>
        {title}
      </h2>
      <p className="mb-0 mt-1 text-xs leading-4 text-muted-foreground">{description}</p>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function KeyStatus({
  configured,
  unavailable,
  removalPending,
}: {
  configured: boolean;
  unavailable: boolean;
  removalPending: boolean;
}) {
  if (removalPending) {
    return (
      <span className="text-xs font-medium text-destructive">
        Key will be removed when you save
      </span>
    );
  }

  if (unavailable) {
    return (
      <span className="text-xs font-medium text-capacity-caution">
        Keychain unavailable — retry access
      </span>
    );
  }

  return configured ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <HugeiconsIcon aria-hidden="true" icon={Tick02Icon} size={14} strokeWidth={2.5} />
      Configured
    </span>
  ) : (
    <span className="text-xs font-medium text-destructive">Required for AI</span>
  );
}

function formatShortcutError(error: string) {
  if (error.includes("conflict")) {
    return "That shortcut is already in use. Choose another one.";
  }
  if (error.includes("invalid") || error.includes("unsupported")) {
    return "Use a modifier plus one supported key.";
  }
  return "Could not register the shortcut. Try again.";
}
