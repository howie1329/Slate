import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { TaskComposerFooter } from "@/components/task-composer-footer";
import { RouteMotionProvider, useRouteMotion, type RouteMotionTransition } from "@/components/route-motion";
import { TaskMotionProvider } from "@/components/task-motion";
import { TaskSelectionProvider, useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { retryPersistence, type PlannerSnapshot } from "@/lib/planner";
import { calculateCapacityState, scopeForTask } from "@/lib/task-groups";
import { hidePopover, openFullApp, useWindowMode, type WindowMode } from "@/lib/window-mode";
import { usePlannerState } from "@/lib/planner-query";

const navLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full px-3.5 text-menu font-medium text-muted-foreground no-underline outline-none transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const activeNavLinkClass =
  "inline-flex h-8 items-center justify-center rounded-full bg-foreground px-3.5 text-menu font-semibold text-background no-underline outline-none transition-colors duration-150 hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const routeFadeEase = [0.23, 1, 0.32, 1] as const;

export const Route = createRootRoute({
  component: () => (
    <RouteMotionProvider>
      <TaskMotionProvider>
        <TaskSelectionProvider>
          <SlateShell />
        </TaskSelectionProvider>
      </TaskMotionProvider>
    </RouteMotionProvider>
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
  const { routeTransition, setRouteTransition } = useRouteMotion();

  useEffect(() => {
    clearSelection("instant");
  }, [clearSelection, pathname]);

  function handleOpenFullApp() {
    void openFullApp();
  }

  function handleRouteNavigation(event: MouseEvent<HTMLAnchorElement>) {
    setRouteTransition(event.detail > 0 ? "animate" : "instant");
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
          !event.target.closest("[data-task-detail], [data-task-row], [data-task-calendar]")
        ) {
          clearSelection();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selectedTaskId && !event.defaultPrevented) {
          event.preventDefault();
          clearSelection("instant");
        } else if (windowMode === "popover" && event.key === "Escape" && !event.defaultPrevented) {
          void hidePopover();
        }
      }}
    >
      {isSettingsPage ? (
        <RouteFade className="h-full min-h-0" key={pathname} transition={routeTransition}>
          <Outlet />
        </RouteFade>
      ) : (
        <>
          <header className={`shrink-0 bg-background px-4 pt-3 sm:px-6 ${pathname === "/today" ? "pb-3" : ""} ${windowMode === "full" ? "px-8" : ""}`}>
            <div className={`mx-auto grid h-10 w-full max-w-xl grid-cols-[4rem_auto_4rem] items-center ${windowMode === "full" ? "max-w-3xl" : ""}`}>
              <HeaderSummary pathname={pathname} planner={planner.data} />
              <nav
                className="flex justify-self-center items-center rounded-full bg-muted p-1"
                aria-label="Task views"
              >
                <Link
                  to="/today"
                  className={navLinkClass}
                  activeProps={{ className: activeNavLinkClass }}
                  onClick={handleRouteNavigation}
                >
                  Today
                </Link>
                <Link
                  to="/backlog"
                  className={navLinkClass}
                  activeProps={{ className: activeNavLinkClass }}
                  onClick={handleRouteNavigation}
                >
                  Backlog
                </Link>
              </nav>
              {windowMode === "popover" ? (
                <Button
                  aria-label="Open full app"
                  className="justify-self-end text-muted-foreground"
                  onClick={handleOpenFullApp}
                  type="button"
                  size="icon"
                  title="Open full app"
                  variant="ghost"
                >
                  <HugeiconsIcon data-icon="inline-start" icon={ArrowUpRight01Icon} strokeWidth={1.8} />
                </Button>
              ) : (
                <span aria-hidden="true" className="justify-self-end" />
              )}
            </div>
            {pathname === "/today" ? <TodayCapacityProgress planner={planner.data} windowMode={windowMode} /> : null}
          </header>

          <div className="slate-workspace relative min-h-0 flex-1">
            <RouteFade className="absolute inset-0" key={pathname} transition={routeTransition}>
              <Outlet />
            </RouteFade>
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

type RouteFadeProps = {
  children: ReactNode;
  className?: string;
  transition: RouteMotionTransition;
};

function RouteFade({ children, className, transition }: RouteFadeProps) {
  return (
    <motion.div
      animate={{ opacity: 1, transform: "translateY(0)" }}
      className={className}
      initial={transition === "animate" ? { opacity: 0.35, transform: "translateY(4px)" } : false}
      transition={{ duration: 0.2, ease: routeFadeEase }}
    >
      {children}
    </motion.div>
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
    const capacity = getTodayCapacity(planner);
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
        className={`justify-self-start text-menu font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none ${tone}`}
        role="status"
      >
        {summary}
      </span>
    );
  }

  if (pathname === "/backlog") {
    const todayScope = `today:${planner.today}`;
    const taskCount = planner.tasks.filter(
      (task) => task.completedAt === null && scopeForTask(task, planner.today) !== todayScope,
    ).length;

    return (
      <span aria-label={`${taskCount} tasks left`} className="justify-self-start text-menu font-semibold tabular-nums text-foreground" role="status">
        {taskCount}
      </span>
    );
  }

  return <span aria-hidden="true" />;
}

function TodayCapacityProgress({ planner, windowMode }: { planner: PlannerSnapshot | undefined; windowMode: WindowMode }) {
  if (!planner) {
    return null;
  }

  const capacity = getTodayCapacity(planner);
  const capacityPercentage = planner.settings.dailyCapacityMinutes > 0
    ? Math.min((capacity.committedMinutes / planner.settings.dailyCapacityMinutes) * 100, 100)
    : 0;
  const status = capacity.isOverCapacity
    ? `${capacity.overageMinutes} min over capacity`
    : `${capacity.remainingMinutes} min remaining`;

  return (
    <div
      aria-label={`${capacity.committedMinutes} of ${planner.settings.dailyCapacityMinutes} minutes committed`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={capacityPercentage}
      aria-valuetext={status}
      className={`mx-auto mt-2 h-1 w-full max-w-xl overflow-hidden rounded-full bg-muted ${windowMode === "full" ? "max-w-3xl" : ""}`}
      role="progressbar"
    >
      <span
        className={`block h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${
          capacity.isOverCapacity ? "bg-destructive" : "bg-primary"
        }`}
        style={{ width: `${capacityPercentage}%` }}
      />
    </div>
  );
}

function getTodayCapacity(planner: PlannerSnapshot) {
  const todayScope = `today:${planner.today}`;
  const activeTasks = planner.tasks.filter((task) => scopeForTask(task, planner.today) === todayScope);

  return calculateCapacityState(activeTasks, planner.settings.dailyCapacityMinutes);
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
