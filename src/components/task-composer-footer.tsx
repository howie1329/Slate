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
import { useTaskMoveUndo } from "@/components/task-move-undo";
import { useTaskSelection } from "@/components/task-selection";
import type { LocalDate } from "@/lib/planner";
import { taskComposerInputId } from "@/lib/task-composer";
import { buildTaskComposerInput, parseTaskComposerCommands } from "@/lib/task-composer-commands";
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
  const { recordTaskMutation } = useTaskMotion();
  const { reportFeedback } = useTaskMoveUndo();
  const { setRouteTransition } = useRouteMotion();
  const { clearSelection, selectedTaskId, selectedTaskTransition } = useTaskSelection();
  const aiReview = useAiReview();
  const [title, setTitle] = useState("");
  const createTransitionRef = useRef<TaskMotionTransition>("instant");
  const hasTitle = title.trim().length > 0;
  const parsedCommands = parseTaskComposerCommands(title);
  const taskInput = planner.data
    ? buildTaskComposerInput(parsedCommands, { scheduledDate, today: planner.data.today })
    : null;
  const hasComposerFeedback = parsedCommands.commands.length > 0 || Boolean(parsedCommands.error && hasTitle);
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

    if (!taskInput || createTask.isPending) {
      return;
    }

    recordTaskMutation({ kind: "create", transition: createTransitionRef.current });
    createTask.mutate(
      {
        ...taskInput,
        source: "manual",
      },
      {
        onSuccess: () => {
          const destination = taskInput.scheduledDate === planner.data?.today ? "today" : "backlog";
          reportFeedback(`${taskInput.title} added to ${destination === "today" ? "Today" : "Backlog"}.`, false, destination);
          setTitle("");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save task."),
      },
    );
  }

  function handleTitleChange(value: string) {
    setTitle(value);
  }

  function handleOpenSettings(event?: { detail?: number }) {
    setRouteTransition(event?.detail ? "animate" : "instant");
    void navigate({ to: "/settings" });
  }

  return (
    <footer
      aria-label="Task composer"
      className={`absolute inset-x-0 bottom-0 z-10 min-h-16 bg-background px-4 py-3 sm:px-6 ${selectedTaskId ? "" : "border-t border-border"} ${windowMode === "full" ? "px-8" : ""}`}
    >
      <AnimatePresence
        custom={selectedTaskTransition}
        initial={false}
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
          aria-describedby={hasComposerFeedback ? "task-composer-status" : undefined}
          aria-invalid={Boolean(parsedCommands.error && hasTitle)}
          className="h-10 text-menu"
          disabled={createTask.isPending}
          id={taskComposerInputId}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Add a task"
          value={title}
        />
        <Button
          aria-label={createTask.isPending ? "Saving task" : "Create task"}
          className="size-8 rounded-md"
          disabled={!taskInput || createTask.isPending}
          size="icon"
          title={createTask.isPending ? "Saving task" : "Save task"}
          type="submit"
          variant={taskInput ? "default" : "outline"}
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
      {hasComposerFeedback ? (
        <div
          aria-live="polite"
          className={`mx-auto mt-1.5 flex min-h-4 w-full max-w-xl gap-1.5 text-menu-label ${parsedCommands.error ? "flex-col items-start" : "items-center"} ${windowMode === "full" ? "max-w-3xl" : ""}`}
          id="task-composer-status"
          role={parsedCommands.error ? "alert" : "status"}
        >
          {parsedCommands.commands.length > 0 ? (
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="shrink-0 text-muted-foreground">Capture:</span>
              <span className="flex min-w-0 flex-wrap items-center gap-1">
                {parsedCommands.commands.map((command, index) => (
                  <span
                    className="inline-flex h-5 items-center rounded-full border border-border bg-muted px-1.5 font-medium text-foreground"
                    key={`${command.kind}-${command.label}-${index}`}
                  >
                    {command.label}
                  </span>
                ))}
              </span>
            </span>
          ) : null}
          {parsedCommands.error ? (
            <span className="min-w-0 text-destructive">{parsedCommands.error}</span>
          ) : null}
        </div>
      ) : null}
    </footer>
  );
}

function isPlanReviewState(state: ReturnType<typeof useAiReview>["state"]) {
  return state.kind.startsWith("plan") || (state.kind === "unavailable" && state.mode === "plan");
}
