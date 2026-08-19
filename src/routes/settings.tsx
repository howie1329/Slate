import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Clock01Icon,
  FileEditIcon,
  InboxIcon,
  Loading03Icon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
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
import { useWindowMode } from "@/lib/window-mode";

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
  const windowMode = useWindowMode();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnLinkRef = useRef<HTMLAnchorElement>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const isReady = Boolean(draft && planner.data);

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
    if (!isReady) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      if (windowMode === "full") {
        headingRef.current?.focus();
      } else {
        returnLinkRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [isReady, windowMode]);

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
    return <SettingsLoadingState windowMode={windowMode} />;
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

  const isFullWindow = windowMode === "full";

  return (
    <section
      aria-labelledby="settings-heading"
      className="flex h-full min-h-0 flex-col bg-background"
      data-settings-layout={isFullWindow ? "full" : "compact"}
    >
      {isFullWindow ? (
        <header className="shrink-0 border-b border-border px-6 py-5">
          <h1
            className="m-0 text-2xl font-semibold leading-[1.875rem] tracking-tight outline-none"
            id="settings-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            Settings
          </h1>
          <p className="mb-0 mt-1 text-xs leading-4 text-muted-foreground">
            Preferences are stored locally on this Mac.
          </p>
        </header>
      ) : (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          <Link
            aria-label="Back to Planning"
            className="inline-flex size-8 items-center justify-center rounded-lg text-foreground no-underline outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            onClick={handleBackToWorkspace}
            ref={returnLinkRef}
            to="/"
          >
            <HugeiconsIcon aria-hidden="true" icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
          </Link>
          <h1 className="m-0 text-menu font-semibold" id="settings-heading" ref={headingRef}>
            Settings
          </h1>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={isFullWindow ? "grid min-h-full grid-cols-1 divide-y divide-border min-[700px]:grid-cols-2 min-[700px]:divide-x min-[700px]:divide-y-0" : "divide-y divide-border"}>
          <div className="min-w-0 divide-y divide-border">
            <SettingsGroup
              description="Control how much work Slate plans for each day."
              icon={Clock01Icon}
              title="Daily capacity"
            >
              <SettingsRow
                control={(
                  <Select
                    onValueChange={(value) => {
                      if (value === "global" || value === "weekly") {
                        updateDraft({ capacityMode: value });
                      }
                    }}
                    value={draft.values.capacityMode}
                  >
                    <SelectTrigger aria-label="Capacity schedule" className="w-40" id="capacity-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="global">Same every day</SelectItem>
                        <SelectItem value="weekly">By weekday</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
                description="Use one capacity or set each weekday separately."
                htmlFor="capacity-mode"
                label="Schedule"
              />
              {draft.values.capacityMode === "global" ? (
                <SettingsRow
                  control={(
                    <InputGroup className="w-36">
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
                  )}
                  description="Total time available for planning each day."
                  htmlFor="daily-capacity"
                  label="Daily capacity"
                />
              ) : (
                <div aria-label="Weekly capacity">
                  {WEEKDAYS.map((weekday) => (
                    <SettingsRow
                      control={(
                        <InputGroup className="w-36">
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
                      )}
                      htmlFor={`capacity-${weekday}`}
                      key={weekday}
                      label={WEEKDAY_LABELS[weekday]}
                    />
                  ))}
                </div>
              )}
            </SettingsGroup>

            <SettingsGroup
              description="Capture a thought from anywhere into Backlog."
              icon={InboxIcon}
              title="Quick capture"
            >
              <SettingsRow
                control={(
                  <button
                    aria-checked={draft.values.quickCaptureEnabled}
                    aria-label="Enable quick capture shortcut"
                    className="inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-muted p-0.5 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked=true]:border-primary data-[checked=true]:bg-primary motion-reduce:transition-none"
                    data-checked={draft.values.quickCaptureEnabled}
                    id="quick-capture-enabled"
                    onClick={() => updateDraft({ quickCaptureEnabled: !draft.values.quickCaptureEnabled })}
                    role="switch"
                    type="button"
                  >
                    <span className={`size-3.5 rounded-full bg-background shadow-sm transition-transform motion-reduce:transition-none ${draft.values.quickCaptureEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                )}
                description="Creates an unestimated Backlog task."
                htmlFor="quick-capture-enabled"
                label="Enable shortcut"
              />
              <SettingsRow
                control={(
                  <div className="flex min-w-0 items-center gap-2 max-[320px]:w-full">
                    <Button
                      aria-describedby="quick-capture-shortcut-description"
                      aria-label={isRecordingShortcut ? "Press a shortcut" : `Current shortcut ${formatShortcut(draft.values.quickCaptureShortcut)}`}
                      className={`min-w-28 font-mono text-xs max-[320px]:flex-1 ${isRecordingShortcut ? "border-primary bg-primary/10 text-foreground" : ""}`}
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
                )}
                description={shortcutError ?? "Use a modifier and one key."}
                descriptionId="quick-capture-shortcut-description"
                error={Boolean(shortcutError)}
                label="Shortcut"
              />
            </SettingsGroup>
          </div>

          <div className="min-w-0 divide-y divide-border">
            <SettingsGroup
              description="Connect your provider and model for planning assistance."
              icon={SparklesIcon}
              title="AI connection"
            >
              <SettingsRow
                control={(
                  <Select
                    onValueChange={(value) => {
                      if (value && isAiProvider(value)) {
                        updateDraft({ aiProvider: value });
                      }
                    }}
                    value={draft.values.aiProvider}
                  >
                    <SelectTrigger aria-label="AI provider" className="w-40" id="ai-provider">
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
                )}
                description="Choose the service Slate uses for AI actions."
                htmlFor="ai-provider"
                label="Provider"
              />
              <SettingsRow
                control={(
                  <Select
                    onValueChange={(value) => {
                      if (value && isAiModel(value)) {
                        updateDraft({ aiModel: value });
                      }
                    }}
                    value={draft.values.aiModel}
                  >
                    <SelectTrigger aria-label="AI model" className="w-40" id="ai-model">
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
                )}
                description="Select the model used for planning and capture."
                htmlFor="ai-model"
                label="Model"
              />
              <SettingsRow
                control={(
                  <Input
                    aria-invalid={keyRequired || keyRemovalPending}
                    aria-label={keyConfigured ? "API key configured. Enter a new key to replace it." : "API key"}
                    autoComplete="off"
                    className="h-8 w-40 tracking-[0.08em]"
                    id="api-key"
                    onBlur={() => setDraft((current) => (current ? blurApiKey(current) : current))}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setDraft((current) => current ? changeApiKey(current, value) : current);
                    }}
                    onFocus={() => setDraft((current) => (current ? focusApiKey(current) : current))}
                    placeholder={keyConfigured ? undefined : "Paste key"}
                    type="password"
                    value={view.keyDisplayValue}
                  />
                )}
                description="Stored securely in the macOS Keychain."
                error={keyRequired || keyRemovalPending}
                htmlFor="api-key"
                label="API key"
              />
              <SettingsRow
                control={(
                  <div className="flex items-center gap-2">
                    <KeyStatus
                      configured={keyConfigured}
                      unavailable={keyUnavailable}
                      removalPending={keyRemovalPending}
                    />
                    {keyRemovalPending ? (
                      <Button
                        onClick={() => setDraft((current) => current ? resetApiKeyChange(current) : current)}
                        size="xs"
                        type="button"
                        variant="ghost"
                      >
                        Keep key
                      </Button>
                    ) : keyConfigured ? (
                      <Button
                        onClick={() => setDraft((current) => current ? markApiKeyForRemoval(current) : current)}
                        size="xs"
                        type="button"
                        variant="ghost"
                      >
                        Remove key
                      </Button>
                    ) : null}
                  </div>
                )}
                description="Changes are applied only when you save."
                label="Status"
              />
            </SettingsGroup>

            <SettingsGroup
              description="Guide how Slate plans and prioritizes your work."
              icon={FileEditIcon}
              title="Planning instruction"
            >
              <div className="border-t border-border py-4">
                <label className="text-menu font-medium" htmlFor="planning-instruction">
                  Instruction
                </label>
                <p className="mb-0 mt-1 text-xs leading-4 text-muted-foreground">
                  Describe your preferences and priorities in up to 2,000 characters.
                </p>
                <Textarea
                  className="mt-3 min-h-28 resize-none text-menu leading-5"
                  id="planning-instruction"
                  maxLength={2000}
                  onChange={(event) => updateDraft({ planningInstruction: event.target.value })}
                  value={draft.values.planningInstruction}
                />
              </div>
            </SettingsGroup>
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="flex min-h-8 w-full items-center justify-between gap-3 max-[320px]:items-end">
          <p className="m-0 min-w-0 text-estimate leading-3 text-muted-foreground">
            Stored locally on this Mac. <span aria-label={`Slate version ${APP_VERSION}`}>Slate v{APP_VERSION}</span>
          </p>
          <Button
            aria-label={saveSettings.isPending ? "Saving settings" : "Save changes"}
            disabled={!view.canSave || saveSettings.isPending}
            onClick={handleSaveSettings}
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
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
  title: string;
};

function SettingsGroup({ children, description, icon, title }: SettingsGroupProps) {
  const headingId = `${title.toLowerCase().replace(/ /g, "-")}-heading`;

  return (
    <section aria-labelledby={headingId} className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
      <header className="flex min-w-0 items-start gap-3">
        <HugeiconsIcon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-foreground"
          icon={icon}
          size={18}
          strokeWidth={1.8}
        />
        <div className="min-w-0">
          <h2 className="m-0 text-menu font-semibold text-foreground" id={headingId}>
            {title}
          </h2>
          <p className="mb-0 mt-1 max-w-[65ch] text-xs leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type SettingsRowProps = {
  control: ReactNode;
  description?: string;
  descriptionId?: string;
  error?: boolean;
  htmlFor?: string;
  label: string;
};

function SettingsRow({
  control,
  description,
  descriptionId,
  error = false,
  htmlFor,
  label,
}: SettingsRowProps) {
  const labelContent = htmlFor ? (
    <label className="text-menu font-medium text-foreground" htmlFor={htmlFor}>
      {label}
    </label>
  ) : (
    <span className="text-menu font-medium text-foreground">{label}</span>
  );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-border py-4 max-[320px]:grid-cols-1">
      <div className="min-w-0">
        {labelContent}
        {description ? (
          <p
            className={`mb-0 mt-1 max-w-[48ch] text-xs leading-4 ${error ? "settings-error-text" : "text-muted-foreground"}`}
            id={descriptionId}
            role={error ? "alert" : undefined}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 justify-self-end max-[320px]:w-full max-[320px]:justify-self-stretch">
        {control}
      </div>
    </div>
  );
}

function SettingsLoadingState({ windowMode }: { windowMode: ReturnType<typeof useWindowMode> }) {
  const isFullWindow = windowMode === "full";

  return (
    <section aria-label="Loading settings" className="flex h-full min-h-0 flex-col" aria-busy="true">
      <header className={isFullWindow ? "shrink-0 border-b border-border px-6 py-5" : "flex h-12 shrink-0 items-center border-b border-border px-4"}>
        <div className={isFullWindow ? "space-y-2" : "w-full"}>
          <div className={`animate-pulse rounded bg-muted motion-reduce:animate-none ${isFullWindow ? "h-7 w-28" : "h-4 w-20"}`} />
          {isFullWindow ? <div className="h-3 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" /> : null}
        </div>
      </header>
      <div className={isFullWindow ? "grid min-h-0 flex-1 grid-cols-2 divide-x divide-border" : "min-h-0 flex-1"}>
        {(isFullWindow ? [0, 1] : [0]).map((column) => (
          <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6" key={column}>
            <div className="h-4 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="mt-3 h-3 w-52 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="mt-5 space-y-4 border-t border-border pt-4">
              <div className="h-8 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="h-8 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
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
      <span className="settings-error-text text-xs font-medium">
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
    <span className="settings-error-text text-xs font-medium">Required for AI</span>
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
