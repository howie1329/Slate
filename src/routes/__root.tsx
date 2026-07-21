import { useEffect, useState } from "react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TaskComposerFooter } from "@/components/task-composer-footer";
import { TaskSelectionProvider, useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { retryPersistence, type PlannerSnapshot } from "@/lib/planner";
import { calculateCapacityState, scopeForTask } from "@/lib/task-groups";
import { hidePopover, openFullApp, useWindowMode } from "@/lib/window-mode";
import { usePlannerState } from "@/lib/planner-query";

const navLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full px-3.5 text-menu font-medium text-muted-foreground no-underline outline-none transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const activeNavLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full bg-foreground px-3.5 text-menu font-semibold text-background no-underline outline-none transition-colors duration-150 hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

export const Route = createRootRoute({
  component: () => (
    <TaskSelectionProvider>
      <SlateShell />
    </TaskSelectionProvider>
  ),
});

function SlateShell() {
  const planner = usePlannerState();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const windowMode = useWindowMode();
  const isSettingsPage = useRouterState({
    select: (state) => state.location.pathname === "/settings",
  });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { clearSelection, selectedTaskId } = useTaskSelection();

  useEffect(() => {
    clearSelection();
  }, [clearSelection, pathname]);

  function handleOpenFullApp() {
    void openFullApp();
  }

  async function handleRetryPersistence() {
    setIsReconnecting(true);
    setReconnectFailed(false);

    try {
      await retryPersistence();
      const result = await planner.refetch();
      setReconnectFailed(result.isError);
    } catch {
      setReconnectFailed(true);
    } finally {
      setIsReconnecting(false);
    }
  }

  if (planner.isError) {
    return <PersistenceRecovery isReconnecting={isReconnecting} onReconnect={handleRetryPersistence} retryFailed={reconnectFailed} />;
  }

  return (
    <main
      className={`relative flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased ${
        windowMode === "popover" ? "rounded-2xl ring-1 ring-border/70" : ""
      }`}
      data-window-mode={windowMode}
      onPointerDownCapture={(event) => {
        if (
          selectedTaskId &&
          event.target instanceof HTMLElement &&
          !event.target.closest("[data-task-detail], [data-task-row], [data-task-calendar], [data-task-detail-dialog]")
        ) {
          clearSelection();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selectedTaskId && !event.defaultPrevented) {
          event.preventDefault();
          clearSelection();
        } else if (windowMode === "popover" && event.key === "Escape" && !event.defaultPrevented) {
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
                <Button
                  aria-label="Open full app"
                  className="justify-self-start text-muted-foreground"
                  onClick={handleOpenFullApp}
                  type="button"
                  size="icon"
                  title="Open full app"
                  variant="ghost"
                >
                  <HugeiconsIcon data-icon="inline-start" icon={ArrowUpRight01Icon} strokeWidth={1.8} />
                </Button>
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
                  to="/backlog"
                  className={navLinkClass}
                  activeProps={{ className: activeNavLinkClass }}
                >
                  Backlog
                </Link>
              </nav>
              <HeaderSummary pathname={pathname} planner={planner.data} />
            </div>
          </header>

          <div className="slate-workspace min-h-0 flex-1">
            <Outlet />
          </div>

          <TaskComposerFooter
            aiIsConfigured={planner.data?.aiAvailability === "configured"}
            scheduledDate={pathname === "/today" ? planner.data?.today ?? null : null}
            windowMode={windowMode}
          />
        </>
      )}
    </main>
  );
}

type HeaderSummaryProps = {
  pathname: string;
  planner: PlannerSnapshot | undefined;
};

function HeaderSummary({ pathname, planner }: HeaderSummaryProps) {
  if (!planner) {
    return <span aria-hidden="true" />;
  }

  if (pathname === "/today") {
    const todayScope = `today:${planner.today}`;
    const activeTasks = planner.tasks.filter((task) => scopeForTask(task, planner.today) === todayScope);
    const capacity = calculateCapacityState(activeTasks, planner.settings.dailyCapacityMinutes);
    const capacityRatio = planner.settings.dailyCapacityMinutes > 0
      ? capacity.remainingMinutes / planner.settings.dailyCapacityMinutes
      : 0;
    const tone = capacity.isOverCapacity
      ? "text-destructive"
      : capacityRatio <= 0.2
        ? "text-capacity-caution"
        : capacityRatio <= 0.5
          ? "text-foreground"
          : "text-primary";
    const summary = capacity.isOverCapacity ? `+${capacity.overageMinutes}m` : `${capacity.remainingMinutes}m`;
    const label = capacity.isOverCapacity
      ? `${capacity.overageMinutes} minutes over capacity`
      : `${capacity.remainingMinutes} minutes remaining`;

    return (
      <span
        aria-label={label}
        className={`justify-self-end text-menu font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none ${tone}`}
        role="status"
      >
        {summary}
      </span>
    );
  }

  if (pathname === "/backlog") {
    const taskCount = planner.tasks.filter((task) => task.completedAt === null).length;

    return (
      <span aria-label={`${taskCount} tasks left`} className="justify-self-end text-menu font-semibold tabular-nums text-foreground" role="status">
        {taskCount}
      </span>
    );
  }

  return <span aria-hidden="true" />;
}

type PersistenceRecoveryProps = {
  isReconnecting: boolean;
  onReconnect: () => Promise<void>;
  retryFailed: boolean;
};

function PersistenceRecovery({ isReconnecting, onReconnect, retryFailed }: PersistenceRecoveryProps) {
  return (
    <main className="flex h-dvh items-center justify-center bg-background px-6 text-foreground">
      <section aria-labelledby="persistence-recovery-heading" className="w-full max-w-sm rounded-lg border border-border bg-card p-5">
        <p className="m-0 text-menu-label font-semibold text-muted-foreground">Local data</p>
        <h1 className="mb-0 mt-2 font-heading text-2xl font-semibold leading-tight tracking-tight" id="persistence-recovery-heading">
          Slate needs to reconnect
        </h1>
        <p className="mb-0 mt-3 max-w-[34ch] text-sm leading-5 text-muted-foreground">
          Your Mac may still be waking up. Refresh to reconnect to your local database without reopening Slate.
        </p>
        {retryFailed ? (
          <p aria-live="polite" className="mb-0 mt-3 text-sm leading-5 text-muted-foreground" role="status">
            Slate is still waiting for the database. Try again in a moment.
          </p>
        ) : null}
        <Button className="mt-5" disabled={isReconnecting} onClick={() => void onReconnect()} type="button">
          {isReconnecting ? "Reconnecting…" : "Refresh connection"}
        </Button>
      </section>
    </main>
  );
}
