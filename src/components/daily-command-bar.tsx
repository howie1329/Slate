import { useRef } from "react";
import { ArrowUpRight01Icon, Loading03Icon, Search01Icon, SentIcon, Settings01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAiReview } from "@/components/ai-review";
import { useRouteMotion } from "@/components/route-motion";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { taskComposerInputId } from "@/lib/task-composer";
import type { WindowMode } from "@/lib/window-mode";
import { openFullApp } from "@/lib/window-mode";
import { useCreateTask, usePlannerState } from "@/lib/planner-query";

type DailyCommandBarProps = {
  onValueChange: (value: string) => void;
  value: string;
  windowMode: WindowMode;
};

export function DailyCommandBar({ onValueChange, value, windowMode }: DailyCommandBarProps) {
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const planner = usePlannerState();
  const aiReview = useAiReview();
  const { setRouteTransition } = useRouteMotion();
  const { clearSelection } = useTaskSelection();
  const { recordTaskMutation } = useTaskMotion();
  const createTransitionRef = useRef<TaskMotionTransition>("instant");
  const hasValue = value.trim().length > 0;
  const aiUnavailable = planner.data?.aiAvailability !== "configured";
  const aiBusy =
    aiReview.state.kind === "assist-loading" ||
    aiReview.state.kind === "plan-loading" ||
    aiReview.state.kind === "plan-accepting";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = value.trim();

    if (!title || createTask.isPending) {
      return;
    }

    recordTaskMutation({ kind: "create", transition: createTransitionRef.current });
    createTask.mutate(
      {
        title,
        estimateMinutes: null,
        scheduledDate: null,
        source: "manual",
      },
      {
        onSuccess: () => onValueChange(""),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save task."),
      },
    );
  }

  function handleAiAction() {
    if (aiUnavailable) {
      handleOpenSettings();
      return;
    }

    clearSelection("instant");
    if (hasValue) {
      const capture = value.trim();
      onValueChange("");
      aiReview.startAssist(capture, null);
    } else {
      aiReview.startPlan();
    }
  }

  function handleOpenSettings() {
    setRouteTransition("animate");
    void navigate({ to: "/settings" });
  }

  return (
    <header className={`sticky top-0 z-10 shrink-0 border-b border-border/70 bg-background px-4 pb-1.5 pt-2 sm:px-6 ${windowMode === "full" ? "px-8" : ""}`}>
      <form
        className={`mx-auto flex h-7 w-full max-w-xl items-center gap-1 ${windowMode === "full" ? "max-w-3xl" : ""}`}
        onKeyDownCapture={() => {
          createTransitionRef.current = "instant";
        }}
        onPointerDownCapture={() => {
          createTransitionRef.current = "animate";
        }}
        onSubmit={handleSubmit}
      >
        <div className="relative min-w-0 flex-1">
          <HugeiconsIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            icon={Search01Icon}
            size={14}
            strokeWidth={1.8}
          />
          <label className="sr-only" htmlFor={taskComposerInputId}>
            Search or add a task
          </label>
          <Input
            aria-label="Search or add a task"
            className="h-7 rounded-md pl-7 pr-2 text-xs"
            disabled={createTask.isPending}
            id={taskComposerInputId}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="Search or add a task"
            value={value}
          />
        </div>
        <Button
          aria-label={createTask.isPending ? "Saving task" : "Add task to Backlog"}
          className="size-7 rounded-md"
          disabled={!hasValue || createTask.isPending}
          size="icon"
          title={createTask.isPending ? "Saving task" : "Add task to Backlog"}
          type="submit"
          variant={hasValue ? "default" : "ghost"}
        >
          <HugeiconsIcon
            className={createTask.isPending ? "animate-spin motion-reduce:animate-none" : undefined}
            icon={createTask.isPending ? Loading03Icon : SentIcon}
            size={14}
            strokeWidth={1.8}
          />
        </Button>
        <Button
          aria-label={
            aiUnavailable
              ? "Configure AI in Settings"
              : aiBusy
                ? "Generating AI review"
                : hasValue
                  ? "Use AI Assist"
                  : "Plan my day with AI"
          }
          className="size-7 rounded-md"
          disabled={aiBusy}
          onClick={handleAiAction}
          size="icon"
          title={
            aiUnavailable
              ? "Configure AI in Settings"
              : aiBusy
                ? "Generating AI review"
                : hasValue
                  ? "Use AI Assist"
                  : "Plan My Day"
          }
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            className={aiBusy ? "animate-pulse motion-reduce:animate-none" : undefined}
            icon={aiUnavailable ? Settings01Icon : SparklesIcon}
            size={14}
            strokeWidth={1.8}
          />
        </Button>
        {windowMode === "popover" ? (
          <Button
            aria-label="Open full app"
            className="size-7 rounded-md"
            onClick={() => void openFullApp()}
            size="icon"
            title="Open full app"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" icon={ArrowUpRight01Icon} size={14} strokeWidth={1.8} />
          </Button>
        ) : null}
      </form>
    </header>
  );
}
