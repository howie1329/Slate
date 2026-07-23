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
import type { AiAssistProposal, AiPlanProposal, LocalDate } from "@/lib/planner";
import { useTaskMotion } from "@/components/task-motion";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AiErrorCategory, AiReviewState } from "@/components/ai-review";
import type { WindowMode } from "@/lib/window-mode";

type AiReviewTrayProps = {
  onAcceptPlan: (proposal: AiPlanProposal) => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
  onRedo: () => void;
  state: AiReviewState;
  windowMode: WindowMode;
};

const panelEnterEase = [0.23, 1, 0.32, 1] as const;

export function AiReviewTray({ onAcceptPlan, onDismiss, onOpenSettings, onRedo, state, windowMode }: AiReviewTrayProps) {
  if (state.kind === "idle") {
    return null;
  }

  return (
    <motion.section
      aria-label="AI review"
      aria-live={state.kind !== "assist" && state.kind !== "plan" ? "polite" : undefined}
      aria-busy={state.kind === "assist-loading" || state.kind === "plan-loading" || state.kind === "plan-accepting"}
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
        {state.kind === "plan-loading" ? <PlanLoadingState /> : null}
        {state.kind === "plan" || state.kind === "plan-accepting" ? (
          <PlanResult
            accepting={state.kind === "plan-accepting"}
            onAccept={() => onAcceptPlan(state.proposal)}
            onDismiss={onDismiss}
            onRedo={onRedo}
            proposal={state.proposal}
          />
        ) : null}
        {state.kind === "plan-empty" ? <PlanEmptyState onDismiss={onDismiss} onRedo={onRedo} proposal={state.proposal} /> : null}
        {state.kind === "plan-error" ? <ErrorState category={state.category} heading="Plan My Day needs another try" onDismiss={onDismiss} onRedo={onRedo} /> : null}
        {state.kind === "plan-stale" ? <PlanStaleState onDismiss={onDismiss} onRedo={onRedo} /> : null}
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

function PlanLoadingState() {
  return (
    <div className="flex min-h-20 items-center gap-3" role="status">
      <HugeiconsIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" icon={Loading03Icon} size={17} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className="m-0 text-menu font-semibold">Plan My Day</p>
        <p className="m-0 mt-0.5 text-xs text-[var(--task-detail-muted)]">Finding a realistic set of backlog tasks…</p>
      </div>
    </div>
  );
}

function PlanResult({
  accepting,
  onAccept,
  onDismiss,
  onRedo,
  proposal,
}: {
  accepting: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onRedo: () => void;
  proposal: AiPlanProposal;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <HugeiconsIcon aria-hidden="true" icon={SparklesIcon} size={16} strokeWidth={1.8} />
        <p className="m-0 text-menu font-semibold">Review Plan My Day</p>
        <span className="ml-auto text-xs text-[var(--task-detail-muted)]">Proposal</span>
      </div>
      <p className="m-0 mt-1 text-xs text-[var(--task-detail-muted)]">
        {proposal.totalMinutes} minutes planned · {proposal.remainingMinutes} minutes left
      </p>
      <div className="mt-3 space-y-1.5" aria-label="Proposed tasks">
        {proposal.items.map((item) => (
          <div className="flex items-center gap-2 rounded-md border border-[var(--task-detail-border)] bg-[var(--task-detail-field)] px-2.5 py-2" key={item.id}>
            <HugeiconsIcon aria-hidden="true" className="shrink-0 text-[var(--task-detail-muted)]" icon={Calendar01Icon} size={15} strokeWidth={1.7} />
            <span className="min-w-0 flex-1 truncate text-menu">{item.title}</span>
            <span className="shrink-0 text-xs text-[var(--task-detail-muted)]">{item.estimateMinutes}m</span>
          </div>
        ))}
      </div>
      {proposal.rationale ? <p className="m-0 mt-2 text-xs leading-4 text-[var(--task-detail-muted)]">{proposal.rationale}</p> : null}
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <Button disabled={accepting} onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        <Button disabled={accepting} onClick={onRedo} size="sm" type="button" variant="outline">Redo</Button>
        <Button disabled={accepting} onClick={onAccept} size="sm" type="button">
          <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={accepting ? Loading03Icon : Tick02Icon} className={accepting ? "animate-spin motion-reduce:animate-none" : undefined} strokeWidth={1.9} />
          {accepting ? "Accepting…" : "Accept plan"}
        </Button>
      </div>
    </div>
  );
}

function PlanEmptyState({ onDismiss, onRedo, proposal }: { onDismiss: () => void; onRedo: () => void; proposal: AiPlanProposal }) {
  const message = proposal.emptyReason === "no-capacity"
    ? "Today is already at capacity. Finish or move a task before planning more work."
    : proposal.emptyReason === "no-eligible-tasks"
      ? "There are no eligible backlog tasks to add to Today."
      : "The provider could not find a combination that fits the remaining time.";

  return (
    <div className="py-1" role="status">
      <p className="m-0 text-menu font-semibold">Nothing to add today</p>
      <p className="m-0 mt-1 text-xs leading-4 text-[var(--task-detail-muted)]">{message}</p>
      <div className="mt-3 flex justify-end gap-1.5">
        <Button onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        <Button onClick={onRedo} size="sm" type="button" variant="outline">Redo</Button>
      </div>
    </div>
  );
}

function PlanStaleState({ onDismiss, onRedo }: { onDismiss: () => void; onRedo: () => void }) {
  return (
    <div className="py-1" role="alert">
      <p className="m-0 text-menu font-semibold">This plan is out of date</p>
      <p className="m-0 mt-1 text-xs leading-4 text-[var(--task-detail-muted)]">Today or one of the proposed tasks changed. Generate a fresh plan to review the current state.</p>
      <div className="mt-3 flex justify-end gap-1.5">
        <Button onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        <Button onClick={onRedo} size="sm" type="button">Generate again</Button>
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

function ErrorState({ category, heading = "AI Assist needs another try", onDismiss, onRedo }: { category: AiErrorCategory; heading?: string; onDismiss: () => void; onRedo: () => void }) {
  return (
    <div className="py-1">
      <p className="m-0 text-menu font-semibold">{heading}</p>
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
      <p className="m-0 text-menu font-semibold">{isPlanUnavailable ? "Plan My Day needs a provider key" : "AI Assist needs a provider key"}</p>
      <p className="m-0 mt-1 text-xs leading-4 text-[var(--task-detail-muted)]">
        {isPlanUnavailable ? "Choose a provider and save its API key in Settings to plan the day." : "Choose a provider and save its API key in Settings to use AI Assist."}
      </p>
      <div className="mt-3 flex justify-end gap-1.5">
        <Button onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        <Button onClick={onOpenSettings} size="sm" type="button" variant="outline">Open Settings</Button>
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
      return "The provider did not return a usable proposal.";
    case "stale-plan":
      return "The planner changed while Slate was working. Generate a fresh plan.";
    default:
      return "Slate could not create a safe AI proposal from the current planner state.";
  }
}
