import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Loading03Icon,
  Search01Icon,
  SparklesIcon,
  TaskAdd01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import type { AiErrorCategory, AiReviewState } from "@/components/ai-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDueDate } from "@/lib/local-date";
import {
  buildReviewedPlan,
  planBuilderItems,
  saferPlanItemIds,
} from "@/lib/plan-builder";
import type { AiPlanItem, AiPlanProposal, PlannerSnapshot } from "@/lib/planner";
import { cn } from "@/lib/utils";

export type PlanReviewState = Extract<AiReviewState, { kind: `plan-${string}` | "plan" }>
  | Extract<AiReviewState, { kind: "unavailable"; mode: "plan" }>;

type PlanningPlanInspectorProps = {
  onAccept: (proposal: AiPlanProposal) => void;
  onDismiss: () => void;
  onOpenSettings?: () => void;
  onRedo: () => void;
  snapshot: PlannerSnapshot;
  state: PlanReviewState;
};

const panelEnterEase = [0.23, 1, 0.32, 1] as const;

export function PlanningPlanInspector({
  onAccept,
  onDismiss,
  onOpenSettings,
  onRedo,
  snapshot,
  state,
}: PlanningPlanInspectorProps) {
  const proposal = reviewProposal(state);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (state.kind === "plan" || state.kind === "plan-accepting") {
      setSelectedIds(new Set(state.proposal.items.map((item) => item.id)));
      setIsBrowsing(false);
      setQuery("");
    }
  }, [state.kind, state.requestId, proposal]);

  const allItems = useMemo(
    () => proposal ? planBuilderItems(snapshot, proposal) : [],
    [proposal, snapshot],
  );
  const selectedItems = allItems.filter((item) => selectedIds.has(item.id));
  const availableItems = allItems.filter((item) => !selectedIds.has(item.id));
  const reviewedPlan = proposal ? buildReviewedPlan(proposal, selectedItems) : null;
  const accepting = state.kind === "plan-accepting";

  function toggleItem(itemId: string) {
    if (accepting) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  if (state.kind === "plan-loading") {
    return <PlanStatus icon="loading" title="Building a realistic day" description="Reviewing eligible Ready work against the capacity you have left…" />;
  }
  if (state.kind === "plan-empty") {
    return (
      <PlanStatus
        actions={<><Button onClick={onDismiss} size="sm" variant="ghost">Dismiss</Button><Button onClick={onRedo} size="sm" variant="outline">Generate again</Button></>}
        description={emptyMessage(state.proposal)}
        title="Nothing useful to add"
      />
    );
  }
  if (state.kind === "plan-error") {
    return (
      <PlanStatus
        actions={<><Button onClick={onDismiss} size="sm" variant="ghost">Dismiss</Button><Button onClick={onRedo} size="sm">Retry</Button></>}
        description={errorMessage(state.category)}
        role="alert"
        title="Plan My Day needs another try"
      />
    );
  }
  if (state.kind === "plan-stale") {
    return (
      <PlanStatus
        actions={<><Button onClick={onDismiss} size="sm" variant="ghost">Dismiss</Button><Button onClick={onRedo} size="sm">Generate again</Button></>}
        description="Today or one of these tasks changed while the proposal was open. Generate a fresh plan before accepting anything."
        role="alert"
        title="This plan is out of date"
      />
    );
  }
  if (state.kind === "unavailable") {
    return (
      <PlanStatus
        actions={<><Button onClick={onDismiss} size="sm" variant="ghost">Dismiss</Button>{onOpenSettings ? <Button onClick={onOpenSettings} size="sm" variant="outline">Open Settings</Button> : null}</>}
        description="Choose a provider and save its API key in Settings to build a plan."
        title="Plan My Day needs a provider key"
      />
    );
  }
  if (!reviewedPlan) return null;

  if (isBrowsing) {
    return (
      <BacklogBrowser
        items={availableItems}
        onAdd={(itemId) => toggleItem(itemId)}
        onBack={() => setIsBrowsing(false)}
        onQueryChange={setQuery}
        query={query}
        today={snapshot.today}
      />
    );
  }

  const capacityLimitMinutes = reviewedPlan.expectedDailyCapacityMinutes;
  const committedMinutes = Math.max(0, capacityLimitMinutes - reviewedPlan.expectedRemainingMinutes);
  const overageMinutes = Math.max(0, -reviewedPlan.remainingMinutes);
  const isOverCapacity = overageMinutes > 0;
  const progress = capacityLimitMinutes > 0
    ? Math.min(100, ((committedMinutes + reviewedPlan.totalMinutes) / capacityLimitMinutes) * 100)
    : 0;
  const saferIds = saferPlanItemIds(allItems, reviewedPlan.expectedRemainingMinutes);
  const canUseSaferMix = reviewedPlan.expectedRemainingMinutes >= 40
    && saferIds.size > 0
    && !sameIds(saferIds, selectedIds);

  return (
    <motion.section
      animate={{ opacity: 1, transform: "translateX(0)" }}
      aria-busy={accepting}
      aria-labelledby="plan-builder-title"
      className="flex h-full min-h-0 flex-col"
      data-plan-builder
      initial={{ opacity: 0, transform: "translateX(8px)" }}
      transition={{ duration: 0.2, ease: panelEnterEase }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HugeiconsIcon aria-hidden="true" icon={SparklesIcon} size={14} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-menu-label font-medium text-[var(--task-detail-muted)]">Editable proposal</p>
            <h2 className="m-0 mt-0.5 text-base font-semibold tracking-[-0.02em]" id="plan-builder-title">Build your day</h2>
          </div>
        </div>
        <p className="mb-0 mt-2 max-w-[42ch] text-xs leading-4 text-[var(--task-detail-muted)]">
          AI made a starting point. Adjust it before anything changes.
        </p>

        <section aria-label="Capacity after this plan" className="mt-5">
          <div className="flex items-end justify-between gap-3 text-capacity tabular-nums">
            <span className="min-w-0 text-[var(--task-detail-muted)]">
              {committedMinutes}m already in Today · {reviewedPlan.totalMinutes}m proposed
            </span>
            <strong className={cn("shrink-0 font-semibold", isOverCapacity && "text-destructive")}>
              {isOverCapacity ? `${overageMinutes}m over` : `${reviewedPlan.remainingMinutes}m left`}
            </strong>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--task-detail-border)]">
            <div
              className={cn("h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none", isOverCapacity && "bg-destructive")}
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section aria-labelledby="proposed-additions-heading" className="mt-5">
          <div className="flex items-center justify-between gap-3 text-menu-label text-[var(--task-detail-muted)]">
            <h3 className="m-0 font-semibold text-inherit" id="proposed-additions-heading">Proposed additions</h3>
            <span className="tabular-nums">{selectedItems.length} {selectedItems.length === 1 ? "task" : "tasks"} · {reviewedPlan.totalMinutes}m</span>
          </div>
          <div className="mt-2 divide-y divide-[var(--task-detail-border)] border-y border-[var(--task-detail-border)]">
            {selectedItems.length ? selectedItems.map((item, index) => (
              <PlanRow
                index={index}
                item={item}
                key={item.id}
                onRemove={() => toggleItem(item.id)}
                today={snapshot.today}
              />
            )) : (
              <p className="m-0 py-4 text-xs leading-4 text-[var(--task-detail-muted)]">
                No additions selected. Add an eligible task or dismiss this proposal.
              </p>
            )}
          </div>
        </section>

        <Button
          className="mt-3 w-full justify-start border-dashed px-2.5 font-normal"
          disabled={accepting || availableItems.length === 0}
          onClick={() => setIsBrowsing(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={TaskAdd01Icon} strokeWidth={1.8} />
          Add from Backlog
          <span className="ml-auto text-metadata text-[var(--task-detail-muted)]">{availableItems.length} eligible</span>
        </Button>

        <details className="group mt-3 border-b border-[var(--task-detail-border)] py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-menu-label font-medium [&::-webkit-details-marker]:hidden">
            Why this mix <span aria-hidden="true" className="text-[var(--task-detail-muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none">⌄</span>
          </summary>
          <p className="mb-1 mt-2 text-xs leading-4 text-[var(--task-detail-muted)]">
            {reviewedPlan.rationale ?? "Slate kept your current Today commitments and chose estimated Ready work that fits the time available."}
          </p>
        </details>

        <details className="group border-b border-[var(--task-detail-border)] py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-menu-label font-medium [&::-webkit-details-marker]:hidden">
            Tasks left out <span className="text-[var(--task-detail-muted)]">{availableItems.length}</span>
          </summary>
          <div className="mt-2 space-y-1.5">
            {availableItems.length ? availableItems.map((item) => (
              <div className="flex items-center justify-between gap-3 text-xs" key={item.id}>
                <span className="min-w-0 truncate text-[var(--task-detail-muted)]">{item.title}</span>
                <span className="shrink-0 tabular-nums text-[var(--task-detail-muted)]">{item.estimateMinutes}m</span>
              </div>
            )) : <p className="m-0 text-xs text-[var(--task-detail-muted)]">Every eligible task is included.</p>}
          </div>
        </details>

        {canUseSaferMix ? (
          <Button
            className="mt-3 w-full justify-start font-normal"
            disabled={accepting}
            onClick={() => setSelectedIds(saferIds)}
            size="sm"
            type="button"
            variant="outline"
          >
            Use a safer mix
            <span className="ml-auto text-metadata text-[var(--task-detail-muted)]">Leaves at least 40m open</span>
          </Button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-[var(--task-detail-border)] bg-[var(--task-detail)] px-3 py-2.5">
        <Button disabled={accepting} onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        <Button disabled={accepting} onClick={onRedo} size="sm" type="button" variant="outline">Generate again</Button>
        <Button
          disabled={accepting || selectedItems.length === 0 || isOverCapacity}
          onClick={() => onAccept(reviewedPlan)}
          size="sm"
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className={accepting ? "animate-spin motion-reduce:animate-none" : undefined}
            data-icon="inline-start"
            icon={accepting ? Loading03Icon : Tick02Icon}
            strokeWidth={1.9}
          />
          {accepting ? "Accepting…" : "Accept plan"}
        </Button>
      </div>
    </motion.section>
  );
}

function BacklogBrowser({
  items,
  onAdd,
  onBack,
  onQueryChange,
  query,
  today,
}: {
  items: AiPlanItem[];
  onAdd: (itemId: string) => void;
  onBack: () => void;
  onQueryChange: (query: string) => void;
  query: string;
  today: string;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => item.title.toLocaleLowerCase().includes(normalizedQuery));

  return (
    <motion.section
      animate={{ opacity: 1, transform: "translateX(0)" }}
      aria-labelledby="backlog-browser-title"
      className="flex h-full min-h-0 flex-col"
      initial={{ opacity: 0, transform: "translateX(8px)" }}
      transition={{ duration: 0.18, ease: panelEnterEase }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-start gap-2">
          <Button aria-label="Back to proposal" className="mt-0.5" onClick={onBack} size="icon-xs" type="button" variant="ghost">
            <HugeiconsIcon aria-hidden="true" icon={ArrowLeft01Icon} strokeWidth={1.8} />
          </Button>
          <div>
            <p className="m-0 text-menu-label text-[var(--task-detail-muted)]">Plan My Day</p>
            <h2 className="m-0 mt-0.5 text-base font-semibold tracking-[-0.02em]" id="backlog-browser-title">Add from Backlog</h2>
          </div>
        </div>

        <div className="relative mt-4">
          <HugeiconsIcon aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--task-detail-muted)]" icon={Search01Icon} size={14} strokeWidth={1.8} />
          <Input
            aria-label="Find eligible Backlog tasks"
            autoFocus
            className="border-[var(--task-detail-border)] bg-[var(--task-detail-field)] pl-7 placeholder:text-[var(--task-detail-muted)]"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Find eligible Backlog tasks…"
            value={query}
          />
        </div>
        <p className="mb-0 mt-2 text-xs leading-4 text-[var(--task-detail-muted)]">Only estimated tasks eligible for Today appear here.</p>

        <div className="mt-3 divide-y divide-[var(--task-detail-border)] border-y border-[var(--task-detail-border)]">
          {filteredItems.length ? filteredItems.map((item) => (
            <div className="flex items-center gap-2 py-2.5" key={item.id}>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-menu font-medium">{item.title}</p>
                <p className="m-0 mt-0.5 text-metadata text-[var(--task-detail-muted)]">{itemContext(item, today)}</p>
              </div>
              <span className="shrink-0 text-estimate tabular-nums text-[var(--task-detail-muted)]">{item.estimateMinutes}m</span>
              <Button aria-label={`Add ${item.title}`} onClick={() => onAdd(item.id)} size="xs" type="button" variant="outline">Add</Button>
            </div>
          )) : (
            <p className="m-0 py-5 text-center text-xs text-[var(--task-detail-muted)]">No eligible tasks match that search.</p>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t border-[var(--task-detail-border)] bg-[var(--task-detail)] p-3">
        <Button className="w-full" onClick={onBack} size="sm" type="button">Done adding tasks</Button>
      </div>
    </motion.section>
  );
}

function PlanRow({ index, item, onRemove, today }: { index: number; item: AiPlanItem; onRemove: () => void; today: string }) {
  return (
    <div className="flex min-h-12 items-center gap-2 py-2">
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-metadata font-semibold text-primary-foreground tabular-nums">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-menu font-medium">{item.title}</p>
        <p className="m-0 mt-0.5 text-metadata text-[var(--task-detail-muted)]">{itemContext(item, today)}</p>
      </div>
      <span className="shrink-0 text-estimate tabular-nums text-[var(--task-detail-muted)]">{item.estimateMinutes}m</span>
      <Button aria-label={`Remove ${item.title}`} onClick={onRemove} size="icon-xs" title="Remove from plan" type="button" variant="ghost">
        <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} strokeWidth={1.8} />
      </Button>
    </div>
  );
}

function PlanStatus({ actions, description, icon, role = "status", title }: { actions?: ReactNode; description: string; icon?: "loading"; role?: "alert" | "status"; title: string }) {
  return (
    <motion.div
      animate={{ opacity: 1, transform: "translateX(0)" }}
      className="flex h-full flex-col justify-center px-5 py-8"
      initial={{ opacity: 0, transform: "translateX(8px)" }}
      role={role}
      transition={{ duration: 0.2, ease: panelEnterEase }}
    >
      <div className="mx-auto w-full max-w-72">
        <div className="flex items-center gap-2">
          {icon === "loading" ? <HugeiconsIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" icon={Loading03Icon} size={16} strokeWidth={1.8} /> : null}
          <h2 className="m-0 text-menu font-semibold">{title}</h2>
        </div>
        <p className="mb-0 mt-1 text-xs leading-4 text-[var(--task-detail-muted)]">{description}</p>
        {actions ? <div className="mt-4 flex justify-end gap-1.5">{actions}</div> : null}
      </div>
    </motion.div>
  );
}

function reviewProposal(state: PlanReviewState) {
  return "proposal" in state ? state.proposal : null;
}

function itemContext(item: AiPlanItem, today: string) {
  if (!item.sourceScheduledDate) return "Unscheduled";
  if (item.sourceScheduledDate < today) return `Overdue · ${formatDueDate(item.sourceScheduledDate)}`;
  return `Scheduled · ${formatDueDate(item.sourceScheduledDate)}`;
}

function sameIds(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every((id) => right.has(id));
}

function emptyMessage(proposal: AiPlanProposal) {
  if (proposal.emptyReason === "no-capacity") return "Today is already at capacity. Finish or move a task before planning more work.";
  if (proposal.emptyReason === "no-eligible-tasks") return "There are no estimated, eligible Backlog tasks to add to Today.";
  return "Slate could not find a useful combination that fits the time you have left.";
}

function errorMessage(category: AiErrorCategory) {
  if (category === "credentials-unavailable") return "Slate could not access the macOS Keychain. Retry access, then try again.";
  if (category === "timeout") return "The provider took too long to respond.";
  if (category === "network") return "Slate could not reach the provider. Check your connection and try again.";
  if (category === "provider-rejected") return "The provider rejected the request. Check the selected model or key in Settings.";
  if (category === "malformed-output") return "The provider returned a proposal Slate could not use.";
  if (category === "no-proposal") return "The provider did not return a usable proposal.";
  return "Slate could not create a safe proposal from the current planner state.";
}
