import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { configuredMockSettings } from "@/mock-data/settings";

const navLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full px-3.5 text-sm font-medium text-muted-foreground no-underline outline-none transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const activeNavLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full bg-foreground px-3.5 text-sm font-semibold text-background no-underline outline-none transition-colors duration-150 hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

export const Route = createRootRoute({
  component: SlateShell,
});

function SlateShell() {
  const aiIsConfigured = configuredMockSettings.aiAvailability === "configured";

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased">
      <header className="shrink-0 px-4 pt-3 sm:px-6">
        <div className="mx-auto grid h-10 w-full max-w-xl grid-cols-[2rem_auto_2rem] items-center">
          <span aria-hidden="true" className="size-8" />
          <nav
            className="flex justify-self-center items-center rounded-full bg-muted p-1"
            aria-label="Task views"
          >
            <Link
              to="/today"
              className={navLinkClass}
              activeProps={{ className: activeNavLinkClass }}
            >
              Today
            </Link>
            <Link
              to="/inbox"
              className={navLinkClass}
              activeProps={{ className: activeNavLinkClass }}
            >
              Log
            </Link>
          </nav>
          <span
            aria-label={aiIsConfigured ? "AI is set up" : "AI is not set up"}
            role="status"
            className="justify-self-end grid size-8 place-items-center rounded-full border border-border bg-card"
          >
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${aiIsConfigured ? "bg-primary" : "bg-muted-foreground"}`}
            />
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>

      <footer
        aria-label="Persistent footer"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 border-t border-border bg-background/95"
      />
    </main>
  );
}
