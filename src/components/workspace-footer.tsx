import { ArrowUpRight01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { AiReviewTray } from "@/components/ai-review-tray";
import { useAiReview } from "@/components/ai-review";
import { useRouteMotion } from "@/components/route-motion";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { useTaskMotion } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { openFullApp, type WindowMode } from "@/lib/window-mode";

type WorkspaceFooterProps = {
  windowMode: WindowMode;
};

export function WorkspaceFooter({ windowMode }: WorkspaceFooterProps) {
  const navigate = useNavigate();
  const { setRouteTransition } = useRouteMotion();
  const { clearTaskMutation, taskMutation } = useTaskMotion();
  const { selectedTaskId, selectedTaskTransition } = useTaskSelection();
  const aiReview = useAiReview();

  function handleOpenSettings() {
    setRouteTransition("animate");
    void navigate({ to: "/settings" });
  }

  return (
    <footer
      aria-label="Workspace utilities"
      className={`absolute inset-x-0 bottom-0 z-10 h-7 border-t border-border bg-muted/40 ${windowMode === "full" ? "px-8" : "px-4 sm:px-6"}`}
    >
      <div className={`mx-auto flex h-full w-full items-center gap-2 ${windowMode === "popover" ? "justify-between" : "justify-end"}`}>
        {windowMode === "popover" ? (
          <Button
            aria-label="Open full app"
            className="size-6 rounded-md text-muted-foreground"
            onClick={() => void openFullApp()}
            size="icon-xs"
            title="Open full app"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" icon={ArrowUpRight01Icon} size={12} strokeWidth={1.8} />
          </Button>
        ) : null}

        <div className="flex items-center gap-1">
          <ThemeToggle className="size-6 rounded-md text-muted-foreground" size="icon-xs" />
          <Button
            aria-label="Open settings"
            className="size-6 rounded-md text-muted-foreground"
            onClick={handleOpenSettings}
            size="icon-xs"
            title="Open settings"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" icon={Settings01Icon} size={12} strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      <AnimatePresence
        custom={selectedTaskTransition}
        initial={false}
        onExitComplete={() => {
          if (taskMutation) {
            const completedVersion = taskMutation.version;
            window.setTimeout(() => clearTaskMutation(completedVersion), 50);
          }
        }}
      >
        {selectedTaskId && aiReview.state.kind === "idle" ? (
          <TaskDetailPanel
            key={selectedTaskId}
            taskId={selectedTaskId}
            transition={selectedTaskTransition}
            windowMode={windowMode}
          />
        ) : null}
        {aiReview.state.kind !== "idle" ? (
          <AiReviewTray
            key="ai-review"
            onDismiss={aiReview.dismiss}
            onOpenSettings={handleOpenSettings}
            onAcceptPlan={aiReview.acceptPlan}
            onRedo={isPlanReviewState(aiReview.state) ? aiReview.redoPlan : aiReview.redoAssist}
            state={aiReview.state}
            windowMode={windowMode}
          />
        ) : null}
      </AnimatePresence>
    </footer>
  );
}

function isPlanReviewState(state: ReturnType<typeof useAiReview>["state"]) {
  return state.kind.startsWith("plan") || (state.kind === "unavailable" && state.mode === "plan");
}
