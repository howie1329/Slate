import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  return (
    <section className="pt-10" aria-labelledby="today-heading">
      <div className="max-w-lg">
        <p className="m-0 text-xs font-semibold leading-tight text-muted-foreground uppercase">Today</p>
        <h1
          id="today-heading"
          className="mt-2 mb-3 font-serif text-4xl leading-none font-medium text-balance sm:text-5xl"
        >
          Make room for what matters.
        </h1>
        <p className="m-0 text-base leading-6 text-pretty text-muted-foreground">
          Your daily capacity and committed tasks will appear here.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card px-5 py-5">
        <div className="flex items-baseline justify-between gap-4 text-sm text-muted-foreground">
          <span>Committed</span>
          <strong className="text-sm text-foreground tabular-nums">0 / 0 min</strong>
        </div>
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className="block h-full w-0 rounded-full bg-primary" />
        </div>
      </div>

      <div className="mt-7 border-t border-border pt-6">
        <p className="m-0 text-xs font-semibold leading-tight text-muted-foreground uppercase">A clear day</p>
        <p className="mt-2 max-w-sm text-base leading-6 text-pretty text-muted-foreground">
          Start from the Inbox, then commit only the work that fits your day.
        </p>
        <Link
          className="mt-4 inline-block text-sm font-semibold text-primary underline decoration-1 underline-offset-4 outline-none hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          to="/inbox"
        >
          Open Inbox
        </Link>
      </div>
    </section>
  );
}
