import { useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Settings } from "@/lib/planner";
import {
  usePlannerState,
  useSetApiKey,
  useUpdateSettings,
} from "@/lib/planner-query";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const MODEL_OPTIONS = [
  { label: "GPT-5 mini", value: "openai/gpt-5-mini" },
  { label: "Claude Sonnet 4.5", value: "anthropic/claude-sonnet-4.5" },
  { label: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash" },
] as const;

function SettingsPage() {
  const planner = usePlannerState();
  const updateSettings = useUpdateSettings();
  const setApiKey = useSetApiKey();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [apiKey, setApiKeyValue] = useState("");

  useEffect(() => {
    if (planner.data) {
      setDraft(planner.data.settings);
    }
  }, [planner.data]);

  if (!draft || !planner.data) {
    return null;
  }

  function updateDraft(patch: Partial<Settings>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function handleSaveSettings() {
    if (!draft) {
      return;
    }

    updateSettings.mutate(draft, {
      onSuccess: () => toast.success("Settings saved."),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save settings."),
    });
  }

  function handleSaveApiKey() {
    if (!draft || !apiKey.trim()) {
      return;
    }

    setApiKey.mutate(
      { provider: draft.aiProvider, apiKey: apiKey.trim() },
      {
        onSuccess: () => {
          setApiKeyValue("");
          toast.success("API key saved in macOS Keychain.");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save API key."),
      },
    );
  }

  const isSaving = updateSettings.isPending || setApiKey.isPending;

  return (
    <section aria-labelledby="settings-heading" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-4 pt-3 sm:px-6">
        <div className="mx-auto flex h-10 w-full max-w-xl items-center">
          <Link
            aria-label="Back to Today"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-foreground no-underline outline-none transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
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
                  value={draft.dailyCapacityMinutes}
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
                value={draft.aiProvider}
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
              <Select onValueChange={(value) => updateDraft({ aiModel: value ?? "" })} value={draft.aiModel}>
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
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="api-key">
              <span>API key</span>
              <span className="flex items-center gap-1.5">
                <Input
                  className="h-8 w-36 tracking-[0.08em]"
                  id="api-key"
                  onChange={(event) => setApiKeyValue(event.target.value)}
                  placeholder="Paste key"
                  type="password"
                  value={apiKey}
                />
                <Button
                  aria-label="Save API key"
                  disabled={!apiKey.trim() || isSaving}
                  onClick={handleSaveApiKey}
                  size="icon"
                  title="Save API key"
                  type="button"
                  variant="destructive"
                >
                  <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={Tick02Icon} strokeWidth={2.5} />
                </Button>
              </span>
            </label>
            <ConfiguredState configured={planner.data.aiAvailability === "configured"} />
          </SettingsGroup>

          <SettingsGroup description="Guides how Slate plans your day." title="Planning instruction">
            <label className="sr-only" htmlFor="planning-instruction">
              Planning instruction
            </label>
            <Textarea
              className="min-h-20 resize-none text-menu leading-5"
              id="planning-instruction"
              onChange={(event) => updateDraft({ planningInstruction: event.target.value })}
              value={draft.planningInstruction}
            />
          </SettingsGroup>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex h-8 w-full max-w-xl items-center justify-between gap-3">
          <p className="m-0 text-xs text-muted-foreground">Stored locally on this Mac.</p>
          <Button disabled={isSaving} onClick={handleSaveSettings} size="sm" type="button">
            Save changes
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
      <div className="mt-3 space-y-2.5">{children}</div>
      <p className="mb-0 mt-3 text-xs leading-4 text-muted-foreground">{description}</p>
    </section>
  );
}

function ConfiguredState({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <HugeiconsIcon aria-hidden="true" icon={Tick02Icon} size={14} strokeWidth={2.5} />
      Configured
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Not set</span>
  );
}
