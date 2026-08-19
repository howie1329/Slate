import { useEffect, useRef } from "react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import { AiReviewTray } from "@/components/ai-review-tray";
import { useAiReview } from "@/components/ai-review";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { useTaskMotion } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";

export function WorkspaceInspector({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { clearTaskMutation, taskMutation } = useTaskMotion();
  const { clearSelection, selectedTaskId, selectedTaskTransition } = useTaskSelection();
  const aiReview = useAiReview();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const mode = aiReview.state.kind !== "idle" ? "ai-review" : `task:${selectedTaskId}`;

  useEffect(() => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement
      && !inspectorRef.current?.contains(activeElement)
    ) {
      triggerRef.current = activeElement;
    }
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [mode]);

  useEffect(() => () => {
    const trigger = triggerRef.current;
    if (trigger?.isConnected) {
      window.requestAnimationFrame(() => trigger.focus());
    }
  }, []);

  function handleClose() {
    if (aiReview.state.kind !== "idle") {
      aiReview.dismiss();
    } else {
      clearSelection();
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--task-detail)] text-[var(--task-detail-foreground)]"
      data-contextual-inspector
      ref={inspectorRef}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--task-detail-border)] px-3">
        <span className="text-menu-label font-semibold">
          {aiReview.state.kind !== "idle" ? "AI review" : "Task detail"}
        </span>
        <Button
          aria-label="Close inspector"
          className="text-[var(--task-detail-muted)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"
          onClick={handleClose}
          ref={closeButtonRef}
          size="icon-xs"
          title="Close inspector"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} strokeWidth={1.8} />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence
          custom={selectedTaskTransition}
          initial={false}
          mode="wait"
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
              windowMode="full"
            />
          ) : null}
          {aiReview.state.kind !== "idle" ? (
            <AiReviewTray
              key="ai-review"
              onAcceptPlan={aiReview.acceptPlan}
              onDismiss={aiReview.dismiss}
              onOpenSettings={onOpenSettings}
              onRedo={isPlanReviewState(aiReview.state) ? aiReview.redoPlan : aiReview.redoAssist}
              state={aiReview.state}
              windowMode="full"
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function isPlanReviewState(state: ReturnType<typeof useAiReview>["state"]) {
  return state.kind.startsWith("plan") || (state.kind === "unavailable" && state.mode === "plan");
}
