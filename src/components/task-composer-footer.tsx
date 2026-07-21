import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon, Settings01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { useTaskSelection } from "@/components/task-selection";
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
  const { selectedTaskId } = useTaskSelection();
  const [title, setTitle] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle || createTask.isPending) {
      return;
    }

    createTask.mutate(
      { title: trimmedTitle, estimateMinutes: null, scheduledDate },
      {
        onSuccess: () => setTitle(""),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save task."),
      },
    );
  }

  return (
    <footer
      aria-label="Task composer"
      className={`absolute inset-x-0 bottom-0 z-10 h-16 bg-background/95 px-4 py-3 sm:px-6 ${selectedTaskId ? "" : "border-t border-border"} ${windowMode === "full" ? "px-8" : ""}`}
    >
      <TaskDetailPanel windowMode={windowMode} />
      <form className={`mx-auto flex h-10 w-full max-w-xl items-center gap-1.5 ${windowMode === "full" ? "max-w-3xl" : ""}`} onSubmit={handleSubmit}>
        <Input
          aria-label="New task"
          className="h-10 text-menu"
          disabled={createTask.isPending}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task"
          value={title}
        />
        <Button
          aria-label="Create task"
          className="size-8 rounded-md"
          disabled={!title.trim() || createTask.isPending}
          size="icon"
          title="Save task"
          type="submit"
          variant="outline"
        >
          <HugeiconsIcon icon={SentIcon} strokeWidth={1.8} />
        </Button>
        <Button
          aria-label="Plan my day with AI"
          className="size-8 rounded-md disabled:opacity-100"
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
          onClick={() => navigate({ to: "/settings" })}
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
