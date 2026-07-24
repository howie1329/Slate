import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, SentIcon, Settings01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { AiReviewTray } from "@/components/ai-review-tray";
import { useAiReview } from "@/components/ai-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { useRouteMotion } from "@/components/route-motion";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { taskComposerInputId } from "@/lib/task-composer";
import type { LocalDate } from "@/lib/planner";
import type { WindowMode } from "@/lib/window-mode";
import { useCreateTask, usePlannerState } from "@/lib/planner-query";

type TaskComposerFooterProps = {
  scheduledDate: LocalDate | null;
  windowMode: WindowMode;
};

export function TaskComposerFooter({ scheduledDate, windowMode }: TaskComposerFooterProps) {
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const planner = usePlannerState();
  const { clearTaskMutation, recordTaskMutation, taskMutation } = useTaskMotion();
  const { setRouteTransition } = useRouteMotion();
  const { clearSelection, selectedTaskId, selectedTaskTransition } = useTaskSelection();
  const aiReview = useAiReview();
  const [title, setTitle] = useState("");
  const createTransitionRef = useRef<TaskMotionTransition>("instant");
  const hasTitle = title.trim().length > 0;
  const aiUnavailable = planner.data?.aiAvailability !== "configured";
  const aiKeyMissing = planner.data?.aiAvailability === "unconfigured";
  const aiButtonDisabled = aiUnavailable || aiReview.state.kind === "assist-loading" || aiReview.state.kind === "plan-loading" || aiReview.state.kind === "plan-accepting";

  function handleAiAction() {
    clearSelection("instant");

    if (hasTitle) {
      const capture = title.trim();
      setTitle("");
      aiReview.startAssist(capture, scheduledDate);
    } else {
      aiReview.startPlan();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle || createTask.isPending) {
      return;
    }

    recordTaskMutation({ kind: "create", transition: createTransitionRef.current });
    createTask.mutate(
      { title: trimmedTitle, estimateMinutes: null, scheduledDate },
      {
        onSuccess: () => setTitle(""),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save task."),
      },
    );
  }

  function handleOpenSettings(event?: { detail?: number }) {
    setRouteTransition(event?.detail ? "animate" : "instant");
    void navigate({ to: "/settings" });
  }

  return (
    <footer
      aria-label="Task composer"
      className={`absolute inset-x-0 bottom-0 z-10 h-16 bg-background px-4 py-3 sm:px-6 ${selectedTaskId ? "" : "border-t border-border"} ${windowMode === "full" ? "px-8" : ""}`}
    >
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
            onOpenSettings={() => {
              setRouteTransition("animate");
              void navigate({ to: "/settings" });
            }}
            onAcceptPlan={aiReview.acceptPlan}
            onRedo={isPlanReviewState(aiReview.state) ? aiReview.redoPlan : aiReview.redoAssist}
            state={aiReview.state}
            windowMode={windowMode}
          />
        ) : null}
      </AnimatePresence>
      <form
        className={`mx-auto flex h-10 w-full max-w-xl items-center gap-1.5 ${windowMode === "full" ? "max-w-3xl" : ""}`}
        onKeyDownCapture={() => {
          createTransitionRef.current = "instant";
        }}
        onPointerDownCapture={() => {
          createTransitionRef.current = "animate";
        }}
        onSubmit={handleSubmit}
      >
        <Input
          aria-label="New task"
          className="h-10 text-menu"
          disabled={createTask.isPending}
          id={taskComposerInputId}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task"
          value={title}
        />
        <Button
          aria-label={createTask.isPending ? "Saving task" : "Create task"}
          className="size-8 rounded-md"
          disabled={!hasTitle || createTask.isPending}
          size="icon"
          title={createTask.isPending ? "Saving task" : "Save task"}
          type="submit"
          variant={hasTitle ? "default" : "outline"}
        >
          <HugeiconsIcon
            className={createTask.isPending ? "animate-spin motion-reduce:animate-none" : undefined}
            icon={createTask.isPending ? Loading03Icon : SentIcon}
            strokeWidth={1.8}
          />
        </Button>
        {aiUnavailable ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  aria-label={aiKeyMissing ? "AI features unavailable; add a provider key in Settings" : "AI features unavailable; retry Keychain access"}
                  className="inline-flex"
                  onClick={handleOpenSettings}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenSettings();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                />
              }
            >
              <Button
                aria-label={aiKeyMissing ? "AI features unavailable; add a provider key in Settings" : "AI features unavailable; retry Keychain access"}
                className="size-8 rounded-md"
                disabled
                size="icon"
                title={aiKeyMissing ? "Add a provider key in Settings to use AI" : "Retry Keychain access to use AI"}
                type="button"
                variant="outline"
              >
                <HugeiconsIcon icon={SparklesIcon} strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {aiKeyMissing ? "Add a provider key in Settings to use AI" : "Retry Keychain access to use AI"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            aria-label={aiReview.state.kind === "assist-loading" ? "Generating AI Assist proposal" : aiReview.state.kind === "plan-loading" ? "Generating Plan My Day proposal" : hasTitle ? "Use AI Assist" : "Plan my day with AI"}
            className="size-8 rounded-md"
            disabled={aiButtonDisabled}
            onClick={handleAiAction}
            size="icon"
            title={aiReview.state.kind === "assist-loading" ? "Generating AI Assist proposal" : aiReview.state.kind === "plan-loading" ? "Generating Plan My Day proposal" : hasTitle ? "Use AI Assist" : "Plan My Day"}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              className={aiReview.state.kind === "assist-loading" || aiReview.state.kind === "plan-loading" || aiReview.state.kind === "plan-accepting" ? "animate-pulse motion-reduce:animate-none" : undefined}
              icon={SparklesIcon}
              strokeWidth={1.8}
            />
          </Button>
        )}
        <Button
          aria-label="Open settings"
          className="size-8 rounded-md"
          onClick={handleOpenSettings}
          size="icon"
          title="Open settings"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={1.8} />
        </Button>
      </form>
    </footer>
  );
}

function isPlanReviewState(state: ReturnType<typeof useAiReview>["state"]) {
  return state.kind.startsWith("plan") || (state.kind === "unavailable" && state.mode === "plan");
}
