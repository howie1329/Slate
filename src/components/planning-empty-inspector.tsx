import {
  Cancel01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import type { PlannerSnapshot } from "@/lib/planner";

export function PlanningEmptyInspector({
  onClose,
  onOpenSettings,
  onPlanMyDay,
  snapshot,
}: {
  onClose: () => void;
  onOpenSettings: () => void;
  onPlanMyDay: () => void;
  snapshot: PlannerSnapshot;
}) {
  const capacity = snapshot.planning.capacity;
  const aiConfigured = snapshot.aiAvailability === "configured";
  const progress = capacity.limitMinutes > 0
    ? Math.min(100, (capacity.committedMinutes / capacity.limitMinutes) * 100)
    : 0;

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-background" data-empty-inspector>
      <Button
        aria-label="Close inspector"
        className="absolute right-2 top-2 z-10"
        onClick={onClose}
        size="icon-sm"
        title="Close inspector"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} strokeWidth={1.8} />
      </Button>

      <div className="flex min-h-0 flex-1 flex-col justify-center px-6 py-8">
        <div className="mx-auto w-full max-w-72">
          <p className="m-0 text-sm font-medium text-foreground">Nothing selected</p>
          <p className="mb-0 mt-1 max-w-[32ch] text-xs leading-4 text-muted-foreground">
            Select a task to inspect it, or build a reviewed plan from estimated Ready work.
          </p>

          <section aria-label="Today capacity" className="mt-5">
            <div className="flex items-center justify-between gap-3 text-capacity tabular-nums">
              <span className="text-muted-foreground">{capacity.committedMinutes}m committed</span>
              <strong className={capacity.isOverCapacity ? "font-semibold text-destructive" : "font-semibold"}>
                {capacity.isOverCapacity ? `${capacity.overageMinutes}m over` : `${capacity.remainingMinutes}m left`}
              </strong>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
              <div className={capacity.isOverCapacity ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"} style={{ width: `${progress}%` }} />
            </div>
          </section>

          <Button
            className="mt-5 w-full justify-start"
            onClick={aiConfigured ? onPlanMyDay : onOpenSettings}
            type="button"
          >
            <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={SparklesIcon} size={14} strokeWidth={1.8} />
            {aiConfigured ? "Plan my day" : "Configure Plan My Day"}
          </Button>
          <p className="mb-0 mt-2 text-metadata leading-3 text-muted-foreground">
            {aiConfigured ? "Nothing changes until you accept the plan." : "Add a provider key in Settings to generate plans."}
          </p>
        </div>
      </div>
    </section>
  );
}
