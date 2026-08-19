import {
  Calendar01Icon,
  Cancel01Icon,
  Note01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

const futureActions = [
  { icon: Note01Icon, label: "Add a note" },
  { icon: SparklesIcon, label: "Plan my day" },
  { icon: Calendar01Icon, label: "Review today" },
] as const;

export function PlanningEmptyInspector({ onClose }: { onClose: () => void }) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-background" data-empty-inspector>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="m-0 text-section-secondary font-medium">Inspector</h2>
        <Button
          aria-label="Close inspector"
          className="ml-auto"
          onClick={onClose}
          size="icon-sm"
          title="Close inspector"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} strokeWidth={1.8} />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center px-6 py-8">
        <div className="mx-auto w-full max-w-72">
          <p className="m-0 text-sm font-medium text-foreground">Nothing selected</p>
          <p className="mb-0 mt-1 max-w-[32ch] text-xs leading-4 text-muted-foreground">
            Select a task to inspect its details. More workspace actions will live here over time.
          </p>

          <div aria-label="Future inspector actions" className="mt-5 flex flex-col gap-2" role="group">
            {futureActions.map((action) => (
              <Button
                className="h-8 justify-start px-2.5 font-normal"
                disabled
                key={action.label}
                type="button"
                variant="outline"
              >
                <HugeiconsIcon aria-hidden="true" icon={action.icon} size={14} strokeWidth={1.7} />
                {action.label}
                <span className="ml-auto text-metadata text-muted-foreground">Soon</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
