import { useRef, useState, type MouseEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon, Settings01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { useRouteMotion } from "@/components/route-motion";
import { useTaskMotion, type TaskMotionTransition } from "@/components/task-motion";
import { useTaskSelection } from "@/components/task-selection";
import { taskComposerInputId } from "@/lib/task-composer";
import type { LocalDate } from "@/lib/planner";
import type { WindowMode } from "@/lib/window-mode";
import { useCreateTask } from "@/lib/planner-query";

type TaskComposerFooterProps = {
  aiIsConfigured: boolean;
  scheduledDate: LocalDate | null;
  windowMode: WindowMode;
};

export function TaskComposerFooter({ aiIsConfigured, scheduledDate, windowMode }: TaskComposerFooterProps) {
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const { recordTaskMutation } = useTaskMotion();
  const { setRouteTransition } = useRouteMotion();
  const { selectedTaskId, selectedTaskTransition } = useTaskSelection();
  const [title, setTitle] = useState("");
  const createTransitionRef = useRef<TaskMotionTransition>("instant");
  const hasTitle = title.trim().length > 0;

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

  function handleOpenSettings(event: MouseEvent<HTMLButtonElement>) {
    setRouteTransition(event.detail > 0 ? "animate" : "instant");
    void navigate({ to: "/settings" });
  }

  return (
    <footer
      aria-label="Task composer"
      className={`absolute inset-x-0 bottom-0 z-10 h-16 bg-background px-4 py-3 sm:px-6 ${selectedTaskId ? "" : "border-t border-border"} ${windowMode === "full" ? "px-8" : ""}`}
    >
      <AnimatePresence custom={selectedTaskTransition} initial={false}>
        {selectedTaskId ? (
          <TaskDetailPanel
            key={selectedTaskId}
            taskId={selectedTaskId}
            transition={selectedTaskTransition}
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
          aria-label="Create task"
          className="size-8 rounded-md"
          disabled={!hasTitle || createTask.isPending}
          size="icon"
          title="Save task"
          type="submit"
          variant={hasTitle ? "default" : "outline"}
        >
          <HugeiconsIcon icon={SentIcon} strokeWidth={1.8} />
        </Button>
        <Button
          aria-label="Plan my day with AI"
          className="size-8 rounded-md"
          disabled
          size="icon"
          title={aiIsConfigured ? "AI planning will be available here" : "Set up AI to plan your day"}
          type="button"
          variant="outline"
        >
          <HugeiconsIcon icon={SparklesIcon} strokeWidth={1.8} />
        </Button>
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
