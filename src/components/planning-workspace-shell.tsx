import type { ReactNode } from "react";
import { PlanningToolbar } from "@/components/planning-toolbar";
import { PlanningWorkspaceFrame } from "@/components/planning-workspace-frame";

type PlanningWorkspaceShellProps = {
  children: ReactNode;
  contentKind: "planning" | "settings" | "recovery";
  globalLayer?: ReactNode;
  inspector?: ReactNode;
  statusMessage?: string;
  toolbar?: ReactNode;
};

export function PlanningWorkspaceShell({
  children,
  contentKind,
  globalLayer,
  inspector = null,
  statusMessage,
  toolbar,
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
      statusBar={statusMessage ? <WorkspaceStatusBar message={statusMessage} /> : null}
      toolbar={toolbar ?? <PlanningToolbar />}
    />
  );
}

function WorkspaceStatusBar({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex h-full items-center px-3">
      <span aria-live="polite" className="text-footer text-muted-foreground" role="status">
        {message}
      </span>
    </div>
  );
}
