import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { configuredMockSettings } from "@/mock-data/settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { settings } = configuredMockSettings;

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
              <span className="flex w-28 items-center gap-1.5">
                <Input
                  className="h-8 text-right tabular-nums disabled:bg-background disabled:opacity-100"
                  disabled
                  id="daily-capacity"
                  type="text"
                  value={settings.dailyCapacityMinutes}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </span>
            </label>
          </SettingsGroup>

          <SettingsGroup description="Your key is stored securely in the macOS Keychain." title="AI connection">
            <SettingRow label="Provider" value="Vercel AI Gateway" />
            <SettingRow label="Model" value="GPT-5 mini" />
            <label className="flex items-center justify-between gap-4 text-menu font-medium" htmlFor="api-key">
              <span>API key</span>
              <span className="flex items-center gap-1.5">
                <Input
                  className="h-8 w-36 tracking-[0.08em] disabled:bg-background disabled:opacity-100"
                  disabled
                  id="api-key"
                  type="password"
                  value="sk-slate-settings"
                />
                <ConfiguredState />
              </span>
            </label>
          </SettingsGroup>

          <SettingsGroup description="Guides how Slate plans your day." title="Planning instruction">
            <label className="sr-only" htmlFor="planning-instruction">
              Planning instruction
            </label>
            <Textarea
              className="min-h-20 resize-none text-menu leading-5 disabled:bg-background disabled:opacity-100"
              disabled
              id="planning-instruction"
              value={settings.planningInstruction}
            />
          </SettingsGroup>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex h-8 w-full max-w-xl items-center justify-between gap-3">
          <p className="m-0 text-xs text-muted-foreground">Stored locally on this Mac.</p>
          <Button disabled size="sm" title="Settings persistence is not available yet" type="button">
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

type SettingRowProps = {
  label: string;
  value: string;
};

function SettingRow({ label, value }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 text-menu font-medium">
      <span>{label}</span>
      <span className="max-w-44 truncate text-xs font-normal text-muted-foreground">{value}</span>
    </div>
  );
}

function ConfiguredState() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <HugeiconsIcon aria-hidden="true" icon={Tick02Icon} size={14} strokeWidth={2.5} />
      <span className="sr-only">AI is </span>Configured
    </span>
  );
}
