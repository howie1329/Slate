import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon, Settings01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WindowMode } from "@/lib/window-mode";

type TaskComposerFooterProps = {
  aiIsConfigured: boolean;
  windowMode: WindowMode;
};

export function TaskComposerFooter({ aiIsConfigured, windowMode }: TaskComposerFooterProps) {
  const navigate = useNavigate();

  return (
    <footer
      aria-label="Task composer"
      className={`absolute inset-x-0 bottom-0 z-10 h-16 border-t border-border bg-background/95 px-4 py-3 sm:px-6 ${windowMode === "full" ? "px-8" : ""}`}
    >
      <form className={`mx-auto flex h-10 w-full max-w-xl items-center gap-1.5 ${windowMode === "full" ? "max-w-3xl" : ""}`} onSubmit={(event) => event.preventDefault()}>
        <Input
          aria-label="New task"
          className="h-10 text-menu disabled:bg-background disabled:opacity-100"
          disabled
          placeholder="Add a task"
        />
        <Button
          aria-label="Create task"
          className="size-8 rounded-md disabled:opacity-100"
          disabled
          size="icon"
          title="Task capture will be available here"
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
