import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  Clock01Icon,
  Loading03Icon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useCreateTask } from "@/lib/planner-query";
import { dateFromLocalDate, formatDueDate, localDateFromDate } from "@/lib/local-date";
import type { AiAssistProposal, LocalDate } from "@/lib/planner";
import { useTaskMotion } from "@/components/task-motion";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AiErrorCategory, AiReviewState } from "@/components/ai-review";
import type { WindowMode } from "@/lib/window-mode";

type AiReviewTrayProps = {
  onDismiss: () => void;
  onOpenSettings: () => void;
  onRedo: () => void;
  state: AiReviewState;
  windowMode: WindowMode;
};

const panelEnterEase = [0.23, 1, 0.32, 1] as const;

export function AiReviewTray({ onDismiss, onOpenSettings, onRedo, state, windowMode }: AiReviewTrayProps) {
  if (state.kind === "idle") {
    return null;
  }

  return (
    <motion.section
      aria-label="AI review"
      aria-live={state.kind === "assist-loading" || state.kind === "assist-error" || state.kind === "unavailable" ? "polite" : undefined}
      aria-busy={state.kind === "assist-loading"}
      className="absolute inset-x-4 bottom-full z-20 max-h-[min(25rem,calc(100dvh-7rem))] overflow-y-auto rounded-t-xl border-x border-t border-[var(--task-detail-border)] bg-[var(--task-detail)] text-[var(--task-detail-foreground)]"
      data-ai-review
      initial={{ opacity: 0, transform: "translateY(10px)" }}
      animate={{ opacity: 1, transform: "translateY(0)" }}
      transition={{ duration: 0.22, ease: panelEnterEase }}
    >
      <div className={`mx-auto w-full max-w-xl px-4 py-3 sm:px-6 ${windowMode === "full" ? "max-w-3xl px-8" : ""}`}>
        {state.kind === "assist-loading" ? <LoadingState /> : null}
        {state.kind === "assist" ? <AssistResult key={state.requestId} onDismiss={onDismiss} onRedo={onRedo} proposal={state.proposal} /> : null}
        {state.kind === "assist-error" ? <ErrorState category={state.category} onDismiss={onDismiss} onRedo={onRedo} /> : null}
        {state.kind === "unavailable" ? (
          <UnavailableState mode={state.mode} onDismiss={onDismiss} onOpenSettings={onOpenSettings} />
        ) : null}
      </div>
    </motion.section>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-20 items-center gap-3" role="status">
      <HugeiconsIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" icon={Loading03Icon} size={17} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className="m-0 text-menu font-semibold">AI Assist</p>
        <p className="m-0 mt-0.5 text-xs text-[var(--task-detail-muted)]">Turning your capture into a task…</p>
      </div>
    </div>
  );
}

function AssistResult({ onDismiss, onRedo, proposal }: { onDismiss: () => void; onRedo: () => void; proposal: AiAssistProposal }) {
  const createTask = useCreateTask();
  const { recordTaskMutation } = useTaskMotion();
  const [title, setTitle] = useState(proposal.title);
  const [estimate, setEstimate] = useState(String(proposal.estimateMinutes));
  const [scheduledDate, setScheduledDate] = useState<LocalDate | null>(proposal.scheduledDate);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(proposal.title);
    setEstimate(String(proposal.estimateMinutes));
    setScheduledDate(proposal.scheduledDate);
    setValidationError(null);
  }, [proposal]);

  function handleAccept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    const nextEstimate = Number(estimate.trim());

    if (!nextTitle) {
      setValidationError("Task title cannot be empty.");
      return;
    }
    if (!Number.isInteger(nextEstimate) || nextEstimate < 1 || nextEstimate > 1_440) {
      setValidationError("Enter a whole number of minutes from 1 to 1440.");
      return;
    }

    setValidationError(null);
    recordTaskMutation({ kind: "create", transition: "animate" });
    createTask.mutate(
      { title: nextTitle, estimateMinutes: nextEstimate, scheduledDate },
      {
        onSuccess: () => {
          onDismiss();
          toast.success("Task saved.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Could not save task.");
        },
      },
    );
  }

  const disabled = createTask.isPending;

  return (
    <form aria-label="Review AI Assist task" onSubmit={handleAccept}>
      <div className="flex items-center gap-2">
        <HugeiconsIcon aria-hidden="true" icon={SparklesIcon} size={16} strokeWidth={1.8} />
        <p className="m-0 text-menu font-semibold">Review AI Assist</p>
        <span className="ml-auto text-xs text-[var(--task-detail-muted)]">Draft</span>
      </div>

      <label className="mt-3 block text-menu-label font-semibold" htmlFor="ai-assist-title">
        Task title
      </label>
      <Input
        autoFocus
        className="mt-1 border-[var(--task-detail-border)] bg-[var(--task-detail-field)] text-[var(--task-detail-foreground)] placeholder:text-[var(--task-detail-muted)]"
        disabled={disabled}
        id="ai-assist-title"
        onChange={(event) => setTitle(event.target.value)}
        value={title}
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-menu-label font-semibold" htmlFor="ai-assist-estimate">
          Estimate
          <span className="relative mt-1 flex items-center">
            <HugeiconsIcon aria-hidden="true" className="pointer-events-none absolute left-2 text-[var(--task-detail-muted)]" icon={Clock01Icon} size={15} strokeWidth={1.7} />
            <Input
              className="border-[var(--task-detail-border)] bg-[var(--task-detail-field)] pl-7 text-[var(--task-detail-foreground)]"
              disabled={disabled}
              id="ai-assist-estimate"
              inputMode="numeric"
              min="1"
              max="1440"
              onChange={(event) => setEstimate(event.target.value)}
              type="number"
              value={estimate}
            />
          </span>
        </label>

        <div>
          <span className="text-menu-label font-semibold">Date</span>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  aria-label="Edit task date"
                  className="mt-1 h-8 w-full justify-start border-[var(--task-detail-border)] px-2 text-[var(--task-detail-foreground)] hover:bg-[var(--task-detail-field)] hover:text-[var(--task-detail-foreground)]"
                  disabled={disabled}
                  type="button"
                  variant="outline"
                />
              }
            >
              <HugeiconsIcon data-icon="inline-start" icon={Calendar01Icon} strokeWidth={1.7} />
              <span className="truncate text-menu">{formatDueDate(scheduledDate)}</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0" data-ai-review-calendar side="top" sideOffset={8}>
              <Calendar
                mode="single"
                onSelect={(date) => {
                  if (date) {
                    setScheduledDate(localDateFromDate(date));
                  }
                }}
                selected={scheduledDate ? dateFromLocalDate(scheduledDate) : undefined}
              />
              <div className="border-t border-border p-2">
                <Button className="w-full" onClick={() => setScheduledDate(null)} size="sm" type="button" variant="ghost">
                  Clear date
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mt-2 min-h-5" aria-live="polite">
        {validationError ? <p className="m-0 text-xs text-destructive">{validationError}</p> : null}
      </div>

      <div className="mt-1 flex items-center justify-end gap-1.5">
        <Button disabled={disabled} onClick={onDismiss} size="sm" type="button" variant="ghost">
          Dismiss
        </Button>
        <Button disabled={disabled} onClick={onRedo} size="sm" type="button" variant="outline">
          Redo
        </Button>
        <Button disabled={disabled} size="sm" type="submit">
          <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={disabled ? Loading03Icon : Tick02Icon} className={disabled ? "animate-spin motion-reduce:animate-none" : undefined} strokeWidth={1.9} />
          {disabled ? "Saving…" : "Accept"}
        </Button>
      </div>
    </form>
  );
}

function ErrorState({ category, onDismiss, onRedo }: { category: AiErrorCategory; onDismiss: () => void; onRedo: () => void }) {
  return (
    <div className="py-1">
      <p className="m-0 text-menu font-semibold">AI Assist needs another try</p>
      <p className="m-0 mt-1 text-xs leading-4 text-[var(--task-detail-muted)]">{errorMessage(category)}</p>
      <div className="mt-3 flex justify-end gap-1.5">
        <Button onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        <Button onClick={onRedo} size="sm" type="button">Retry</Button>
      </div>
    </div>
  );
}

function UnavailableState({ mode, onDismiss, onOpenSettings }: { mode: "assist" | "plan"; onDismiss: () => void; onOpenSettings: () => void }) {
  const isPlanUnavailable = mode === "plan";
  return (
    <div className="py-1">
      <p className="m-0 text-menu font-semibold">{isPlanUnavailable ? "Plan My Day is not available yet" : "AI Assist needs a provider key"}</p>
      <p className="m-0 mt-1 text-xs leading-4 text-[var(--task-detail-muted)]">
        {isPlanUnavailable ? "This first AI slice focuses on Assist. Your manual task workflow is unchanged." : "Choose a provider and save its API key in Settings to use AI Assist."}
      </p>
      <div className="mt-3 flex justify-end gap-1.5">
        <Button onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        {!isPlanUnavailable ? <Button onClick={onOpenSettings} size="sm" type="button" variant="outline">Open Settings</Button> : null}
      </div>
    </div>
  );
}

function errorMessage(category: AiErrorCategory) {
  switch (category) {
    case "timeout":
      return "The provider took too long to respond.";
    case "network":
      return "Slate could not reach the provider. Check your connection and try again.";
    case "provider-rejected":
      return "The provider rejected the request. Check the selected model or key in Settings.";
    case "malformed-output":
      return "The provider returned a proposal Slate could not use.";
    case "no-proposal":
      return "The provider did not return a usable estimate and task proposal.";
    default:
      return "Slate could not create a safe proposal from that capture.";
  }
}
