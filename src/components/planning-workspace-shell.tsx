import type { ReactNode } from "react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlanningToolbar } from "@/components/planning-toolbar";
import { PlanningWorkspaceFrame } from "@/components/planning-workspace-frame";
import { Button } from "@/components/ui/button";

type PlanningWorkspaceShellProps = {
  children: ReactNode;
  contentKind: "planning" | "settings" | "recovery";
  globalLayer?: ReactNode;
  inspector?: ReactNode;
  onOpenSettings: () => void;
  statusMessage?: string;
};

export function PlanningWorkspaceShell({
  children,
  contentKind,
  globalLayer,
  inspector = null,
  onOpenSettings,
  statusMessage,
}: PlanningWorkspaceShellProps) {
  return (
    <PlanningWorkspaceFrame
      futureViewsCue={null}
      globalLayer={globalLayer}
      inspector={inspector}
      mainContentLayout="full"
      mainContent={children}
      mainLabel={
        contentKind === "settings"
          ? "Settings content"
          : contentKind === "recovery"
            ? "Local data recovery"
            : "Planning content"
      }
      showFutureViewsCue={false}
      statusBar={(
        <WorkspaceStatusBar
          isSettingsPage={contentKind === "settings"}
          message={statusMessage}
          onOpenSettings={onOpenSettings}
        />
      )}
      toolbar={<PlanningToolbar />}
    />
  );
}

function WorkspaceStatusBar({
  isSettingsPage,
  message,
  onOpenSettings,
}: {
  isSettingsPage: boolean;
  message?: string;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-between px-3">
      <span aria-live="polite" className="text-footer text-muted-foreground" role="status">
        {message}
      </span>
      <Button
        aria-current={isSettingsPage ? "page" : undefined}
        aria-label="Open settings"
        className="h-5 gap-1 rounded px-1.5 text-footer font-normal text-muted-foreground"
        disabled={isSettingsPage}
        onClick={onOpenSettings}
        title="Open settings"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon aria-hidden="true" icon={Settings01Icon} size={9} strokeWidth={1.8} />
        <span>Settings</span>
      </Button>
    </div>
  );
}
