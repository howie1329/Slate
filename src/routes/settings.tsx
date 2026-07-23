import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
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
import type { Settings } from "@/lib/planner";
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

const MODEL_OPTIONS = [
  { label: "GPT-5 mini", value: "openai/gpt-5-mini" },
  { label: "Claude Sonnet 4.5", value: "anthropic/claude-sonnet-4.5" },
  { label: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash" },
] as const;
const APP_VERSION = appPackage.version;

function SettingsPage() {
  const planner = usePlannerState();
  const saveSettings = useSaveSettings();
  const { setRouteTransition } = useRouteMotion();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);

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

  if (!draft || !planner.data) {
    return null;
  }

  const view = settingsDraftView(draft);
  const keyConfigured =
    draft.availabilityByProvider[draft.values.aiProvider] === "configured";
  const keyRequired = !keyConfigured && draft.key.kind !== "remove";
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

  function handleBackToToday(event: MouseEvent<HTMLAnchorElement>) {
    setRouteTransition(event.detail > 0 ? "animate" : "instant");
  }

  return (
    <section aria-labelledby="settings-heading" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-4 pt-3 sm:px-6">
        <div className="mx-auto flex h-10 w-full max-w-xl items-center">
          <Link
            aria-label="Back to Today"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-foreground no-underline outline-none transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            onClick={handleBackToToday}
            to="/today"
          >
            <HugeiconsIcon aria-hidden="true" icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            <span id="settings-heading">Settings</span>
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-xl space-y-4">
          <SettingsGroup description="Used for planning your day." title="Daily capacity">
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
          </SettingsGroup>

          <SettingsGroup description="Your key is stored securely in the macOS Keychain." title="AI connection">
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="ai-provider">
              <span>Provider</span>
              <Select
                onValueChange={(value) => updateDraft({ aiProvider: value as Settings["aiProvider"] })}
                value={draft.values.aiProvider}
              >
                <SelectTrigger aria-label="AI provider" className="w-40 text-xs font-normal" id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="vercel-gateway">Vercel AI Gateway</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="ai-model">
              <span>Model</span>
              <Select
                onValueChange={(value) => updateDraft({ aiModel: value ?? "" })}
                value={draft.values.aiModel}
              >
                <SelectTrigger aria-label="AI model" className="w-40 text-xs font-normal" id="ai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MODEL_OPTIONS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
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
  removalPending,
}: {
  configured: boolean;
  removalPending: boolean;
}) {
  if (removalPending) {
    return (
      <span className="text-xs font-medium text-destructive">
        Key will be removed when you save
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
