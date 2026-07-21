import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TaskComposerFooter } from "@/components/task-composer-footer";
import { configuredMockSettings } from "@/mock-data/settings";

const navLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full px-3.5 text-menu font-medium text-muted-foreground no-underline outline-none transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const activeNavLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full bg-foreground px-3.5 text-menu font-semibold text-background no-underline outline-none transition-colors duration-150 hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

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
            className={`justify-self-end size-2.5 rounded-full ${
              aiIsConfigured ? "bg-primary" : "bg-muted-foreground"
            }`}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>

      <TaskComposerFooter aiIsConfigured={aiIsConfigured} />
    </main>
  );
}
