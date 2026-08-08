import { useEffect, useState, type ReactNode } from "react";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useAiReview } from "@/components/ai-review";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { QuickCaptureWindow } from "@/components/quick-capture-window";
import { TaskComposerFooter } from "@/components/task-composer-footer";
import { RouteMotionProvider, useRouteMotion, type RouteMotionTransition } from "@/components/route-motion";
import { TaskMotionProvider } from "@/components/task-motion";
import { TaskSelectionProvider, useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { retryPersistence } from "@/lib/planner";
import { hidePopover, useWindowMode } from "@/lib/window-mode";
import { usePlannerState } from "@/lib/planner-query";

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
  const { dismiss: dismissAiReview, state: aiReviewState } = useAiReview();
  const { routeTransition, setRouteTransition } = useRouteMotion();

  useEffect(() => {
    clearSelection("instant");
    dismissAiReview();
    setRouteTransition("instant");
  }, [clearSelection, dismissAiReview, pathname, setRouteTransition]);

  if (windowMode === "quick-capture") {
    return <QuickCaptureWindow />;
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
        const target = event.target instanceof Element ? event.target : null;
        const isInsideReview = target?.closest("[data-ai-review], [data-ai-review-calendar]");
        const isInsideOnboarding = target?.closest("[data-onboarding]");

        if (aiReviewState.kind !== "idle" && !isInsideReview) {
          dismissAiReview();
        }
        if (selectedTaskId && !isInsideOnboarding && !target?.closest("[data-task-detail], [data-task-row], [data-task-calendar]")) {
          clearSelection();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && aiReviewState.kind !== "idle" && !event.defaultPrevented) {
          event.preventDefault();
          dismissAiReview();
        } else if (event.key === "Escape" && selectedTaskId && !event.defaultPrevented) {
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
          <div className="slate-workspace relative min-h-0 flex-1">
            <RouteFade className="absolute inset-0" key={pathname} transition={routeTransition}>
              <Outlet />
            </RouteFade>
          </div>

          <TaskComposerFooter
            windowMode={windowMode}
          />
        </>
      )}
      {planner.data ? (
        <OnboardingFlow
          isSettingsPage={isSettingsPage}
          pathname={pathname}
          planner={planner.data}
          windowMode={windowMode}
        />
      ) : null}
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
