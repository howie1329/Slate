import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TaskComposerFooter } from "@/components/task-composer-footer";
import { hidePopover, openFullApp, useWindowMode } from "@/lib/window-mode";
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
  const windowMode = useWindowMode();
  const isSettingsPage = useRouterState({
    select: (state) => state.location.pathname === "/settings",
  });

  function handleOpenFullApp() {
    void openFullApp();
  }

  return (
    <main
      className={`relative flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased ${
        windowMode === "popover" ? "rounded-2xl ring-1 ring-border/70" : ""
      }`}
      data-window-mode={windowMode}
      onKeyDown={(event) => {
        if (windowMode === "popover" && event.key === "Escape" && !event.defaultPrevented) {
          void hidePopover();
        }
      }}
    >
      {isSettingsPage ? (
        <Outlet />
      ) : (
        <>
          <header className={`shrink-0 px-4 pt-3 sm:px-6 ${windowMode === "full" ? "px-8" : ""}`}>
            <div className={`mx-auto grid h-10 w-full max-w-xl grid-cols-[4rem_auto_4rem] items-center ${windowMode === "full" ? "max-w-3xl" : ""}`}>
              {windowMode === "popover" ? (
                <button
                  className="justify-self-start rounded-md px-2 py-1 text-menu font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                  onClick={handleOpenFullApp}
                  type="button"
                >
                  Open
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
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
                  Backlog
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

          <div className="slate-workspace min-h-0 flex-1">
            <Outlet />
          </div>

          <TaskComposerFooter aiIsConfigured={aiIsConfigured} windowMode={windowMode} />
        </>
      )}
    </main>
  );
}
