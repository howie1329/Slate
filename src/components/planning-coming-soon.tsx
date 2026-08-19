import { LayoutGridIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function PlanningComingSoon() {
  return (
    <section
      aria-labelledby="planning-coming-soon-heading"
      className="flex h-full min-h-0 items-center justify-center px-6"
      data-planning-coming-soon
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
          <HugeiconsIcon aria-hidden="true" icon={LayoutGridIcon} size={18} strokeWidth={1.6} />
        </span>
        <h2
          className="mb-0 mt-4 text-title font-semibold tracking-tight"
          id="planning-coming-soon-heading"
        >
          Coming soon
        </h2>
        <p className="mb-0 mt-1.5 text-sm leading-5 text-muted-foreground">
          Planning views are on the way.
        </p>
      </div>
    </section>
  );
}
