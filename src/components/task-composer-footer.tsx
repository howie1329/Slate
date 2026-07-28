import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Loading03Icon, SentIcon, Settings01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
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
import { clearQuickCaptureDraft, getQuickCaptureDraft, isTauriWindow, setQuickCaptureDraft } from "@/lib/planner";
import type { LocalDate } from "@/lib/planner";
import { taskComposerInputId } from "@/lib/task-composer";
import type { WindowMode } from "@/lib/window-mode";
import { useCreateTask, usePlannerState, useUndoQuickCapture } from "@/lib/planner-query";

type TaskComposerFooterProps = {
  scheduledDate: LocalDate | null;
  windowMode: WindowMode;
};

export function TaskComposerFooter({ scheduledDate, windowMode }: TaskComposerFooterProps) {
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const undoQuickCapture = useUndoQuickCapture();
  const planner = usePlannerState();
  const { clearTaskMutation, recordTaskMutation, taskMutation } = useTaskMotion();
  const { setRouteTransition } = useRouteMotion();
  const { clearSelection, selectedTaskId, selectedTaskTransition } = useTaskSelection();
  const aiReview = useAiReview();
  const [title, setTitle] = useState("");
  const [isQuickCapture, setIsQuickCapture] = useState(false);
  const createTransitionRef = useRef<TaskMotionTransition>("instant");
  const draftTimerRef = useRef<number | undefined>(undefined);
  const hasTitle = title.trim().length > 0;
  const aiUnavailable = planner.data?.aiAvailability !== "configured";
  const aiKeyMissing = planner.data?.aiAvailability === "unconfigured";
  const aiButtonDisabled = aiUnavailable || aiReview.state.kind === "assist-loading" || aiReview.state.kind === "plan-loading" || aiReview.state.kind === "plan-accepting";

  useEffect(() => {
    if (!isTauriWindow()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listen("quick-capture://opened", () => {
      clearSelection("instant");
      aiReview.dismiss();
      setIsQuickCapture(true);
      void getQuickCaptureDraft().then((draft) => {
        setTitle(draft?.title ?? "");
        window.setTimeout(() => document.getElementById(taskComposerInputId)?.focus(), 0);
      }).catch(() => {
        setTitle("");
        window.setTimeout(() => document.getElementById(taskComposerInputId)?.focus(), 0);
      });
    }).then((stopListening) => {
      if (disposed) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [aiReview, clearSelection]);

  useEffect(() => () => {
    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }
  }, []);

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

    const quickCapture = isQuickCapture;
    recordTaskMutation({ kind: "create", transition: createTransitionRef.current });
    createTask.mutate(
      {
        title: trimmedTitle,
        estimateMinutes: null,
        scheduledDate: quickCapture ? null : scheduledDate,
        source: quickCapture ? "manual-quick-capture" : "manual",
      },
      {
        onSuccess: (created) => {
          setTitle("");
          if (!quickCapture) {
            return;
          }
          setIsQuickCapture(false);
          void clearQuickCaptureDraft();
          toast.success("Captured to Backlog.", {
            duration: 5000,
            action: {
              label: "Undo",
              onClick: () => {
                undoQuickCapture.mutate(
                  { id: created.id, expectedRevision: created.revision },
                  {
                    onSuccess: () => {
                      void clearQuickCaptureDraft();
                      toast.success("Capture undone.");
                    },
                    onError: async (error) => {
                      const message = error instanceof Error ? error.message : String(error);
                      await planner.refetch();
                      toast.error(message.includes("stale-quick-capture")
                        ? "This capture changed and can’t be undone."
                        : "This capture can’t be undone.");
                    },
                  },
                );
              },
            },
          });
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save task."),
      },
    );
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!isQuickCapture) {
      return;
    }
    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }
    draftTimerRef.current = window.setTimeout(() => {
      void setQuickCaptureDraft(value);
    }, 250);
  }

  function handleDiscardQuickCapture() {
    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }
    setTitle("");
    setIsQuickCapture(false);
    void clearQuickCaptureDraft();
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
          aria-label={isQuickCapture ? "Quick capture title" : "New task"}
          className="h-10 text-menu"
          disabled={createTask.isPending}
          id={taskComposerInputId}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder={isQuickCapture ? "Capture to Backlog" : "Add a task"}
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
        {isQuickCapture && hasTitle ? (
          <Button
            aria-label="Discard quick capture"
            className="size-8 rounded-md"
            onClick={handleDiscardQuickCapture}
            size="icon"
            title="Discard quick capture"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.8} />
          </Button>
        ) : null}
        {!isQuickCapture && aiUnavailable ? (
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
        ) : !isQuickCapture ? (
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
        ) : null}
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
