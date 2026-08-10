import {
  createElement,
  type CSSProperties,
  type ReactNode,
} from "react";

export const PLANNING_SHELL_METRICS = {
  dailyMaxWidth: 720,
  dockedInspectorWidth: 320,
  inspectorDockThreshold: 960,
  statusBarHeight: 24,
  toolbarControlHeight: 24,
  toolbarHeight: 32,
} as const;

type PlanningWorkspaceFrameProps = {
  futureViewsCue: ReactNode;
  globalLayer?: ReactNode;
  inspector: ReactNode | null;
  mainContentLayout?: "bounded" | "full";
  mainContent: ReactNode;
  mainLabel: "Planning content" | "Settings content" | "Local data recovery";
  showFutureViewsCue: boolean;
  statusBar: ReactNode;
  toolbar: ReactNode;
};

type ShellStyle = CSSProperties & Record<`--planning-${string}`, string>;

const shellStyle: ShellStyle = {
  "--planning-content-max-width": `${PLANNING_SHELL_METRICS.dailyMaxWidth}px`,
  "--planning-inspector-width": `${PLANNING_SHELL_METRICS.dockedInspectorWidth}px`,
  "--planning-status-height": `${PLANNING_SHELL_METRICS.statusBarHeight}px`,
  "--planning-toolbar-height": `${PLANNING_SHELL_METRICS.toolbarHeight}px`,
};

export function PlanningWorkspaceFrame({
  futureViewsCue,
  globalLayer,
  inspector,
  mainContentLayout = "bounded",
  mainContent,
  mainLabel,
  showFutureViewsCue,
  statusBar,
  toolbar,
}: PlanningWorkspaceFrameProps) {
  return createElement(
    "div",
    {
      className: "planning-workspace-frame flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground",
      "data-planning-workspace-shell": "",
      style: shellStyle,
    },
    createElement(
      "header",
      {
        "aria-label": "Planning toolbar",
        className: "planning-workspace-toolbar shrink-0 border-b border-border bg-background",
        "data-planning-shell-region": "toolbar",
      },
      toolbar,
    ),
    createElement(
      "div",
      {
        className: "planning-workspace-canvas relative flex min-h-0 flex-1 overflow-hidden",
      },
      createElement(
        "main",
        {
          "aria-label": mainLabel,
          className: "planning-workspace-main relative min-w-0 flex-1 overflow-hidden",
          "data-planning-shell-region": "main",
        },
        showFutureViewsCue
          ? createElement(
              "div",
              {
                className: "planning-workspace-future-cue",
                "data-planning-future-cue": "",
              },
              futureViewsCue,
            )
          : null,
        createElement(
          "div",
          {
            className: `planning-workspace-content ${mainContentLayout === "bounded" ? "planning-workspace-content-daily" : "planning-workspace-content-route"}`,
          },
          mainContent,
        ),
      ),
      inspector
        ? createElement(
            "aside",
            {
              "aria-label": "Workspace inspector",
              className: "planning-workspace-inspector",
              "data-contextual-inspector": "",
              "data-planning-shell-region": "inspector",
            },
            inspector,
          )
        : null,
    ),
    createElement(
      "footer",
      {
        "aria-label": "Workspace status",
        className: "planning-workspace-status shrink-0 border-t border-border bg-muted/40",
        "data-planning-shell-region": "status",
      },
      statusBar,
    ),
    globalLayer,
  );
}
