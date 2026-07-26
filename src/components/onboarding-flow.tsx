import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouteMotion } from "@/components/route-motion";
import { useTaskSelection } from "@/components/task-selection";
import type { PlannerSnapshot } from "@/lib/planner";
import { buildOnboardingSettingsInput, shouldOfferOnboarding, type OnboardingStep } from "@/lib/onboarding";
import { focusTaskComposer } from "@/lib/task-composer";
import { useSaveSettings } from "@/lib/planner-query";
import type { WindowMode } from "@/lib/window-mode";

type OnboardingFlowProps = {
  isSettingsPage: boolean;
  pathname: string;
  planner: PlannerSnapshot;
  windowMode: WindowMode;
};

export function OnboardingFlow({ isSettingsPage, pathname, planner, windowMode }: OnboardingFlowProps) {
  const navigate = useNavigate();
  const saveSettings = useSaveSettings();
  const { setRouteTransition } = useRouteMotion();
  const { selectTask } = useTaskSelection();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const baselineTaskIdsRef = useRef<Set<string> | null>(null);
  const completionStartedRef = useRef(false);
  const [active, setActive] = useState(() => shouldOfferOnboarding(planner.settings.onboardingStatus, planner.tasks.length));
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [capacityDraft, setCapacityDraft] = useState(String(planner.settings.dailyCapacityMinutes));
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [onboardingTaskId, setOnboardingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!active || isSettingsPage) {
      return;
    }

    if (step === "capture" && pathname === "/backlog") {
      const focusFrame = window.requestAnimationFrame(() => focusTaskComposer());
      return () => window.cancelAnimationFrame(focusFrame);
    }

    headingRef.current?.focus();
  }, [active, isSettingsPage, pathname, step]);

  useEffect(() => {
    if (!active || step !== "capture" || !baselineTaskIdsRef.current) {
      return;
    }

    const onboardingTask = planner.tasks
      .filter((task) => !baselineTaskIdsRef.current?.has(task.id))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];

    if (!onboardingTask) {
      return;
    }

    setOnboardingTaskId(onboardingTask.id);
    selectTask(onboardingTask.id, "animate");
    setStep("commit");
  }, [active, planner.tasks, selectTask, step]);

  useEffect(() => {
    if (!active || step !== "commit" || !onboardingTaskId) {
      return;
    }

    const onboardingTask = planner.tasks.find((task) => task.id === onboardingTaskId);

    if (!onboardingTask) {
      setOnboardingTaskId(null);
      setStep("capture");
      return;
    }

    if (
      onboardingTask.estimateMinutes === null
      || onboardingTask.estimateMinutes <= 0
      || onboardingTask.scheduledDate !== planner.today
      || completionStartedRef.current
    ) {
      return;
    }

    completionStartedRef.current = true;
    setStep("complete");
    saveSettings.mutate(
      buildOnboardingSettingsInput(planner.settings, { onboardingStatus: "completed" }),
      {
        onError: (error) => {
          completionStartedRef.current = false;
          setStep("commit");
          toast.error(error instanceof Error ? error.message : "Could not save onboarding progress.");
        },
        onSuccess: () => {
          setRouteTransition("animate");
          void navigate({ to: "/today" });
        },
      },
    );
  }, [active, navigate, onboardingTaskId, planner.settings, planner.tasks, planner.today, saveSettings, setRouteTransition, step]);

  if (!active || isSettingsPage) {
    return null;
  }

  function handleSkip() {
    saveSettings.mutate(
      buildOnboardingSettingsInput(planner.settings, { onboardingStatus: "skipped" }),
      {
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save onboarding preference."),
        onSuccess: () => setActive(false),
      },
    );
  }

  function handleConfirmCapacity() {
    const value = Number(capacityDraft.trim());
    if (!Number.isInteger(value) || value <= 0) {
      setCapacityError("Enter a positive number of minutes.");
      return;
    }

    setCapacityError(null);
    saveSettings.mutate(
      buildOnboardingSettingsInput(planner.settings, { dailyCapacityMinutes: value }),
      {
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save daily capacity."),
        onSuccess: () => {
          baselineTaskIdsRef.current = new Set(planner.tasks.map((task) => task.id));
          setStep("capture");
          setRouteTransition("animate");
          void navigate({ to: "/backlog" });
        },
      },
    );
  }

  function handleOpenBacklog() {
    setRouteTransition("animate");
    void navigate({ to: "/backlog" });
  }

  function handleContinue() {
    setActive(false);
  }

  const panelMaxWidth = windowMode === "full" ? "max-w-3xl" : "max-w-xl";

  return (
    <section
      aria-labelledby="onboarding-heading"
      className={`pointer-events-auto absolute inset-x-4 top-4 z-20 mx-auto w-auto rounded-xl border border-border bg-card p-4 text-card-foreground ${panelMaxWidth} sm:inset-x-6 sm:p-5 ${windowMode === "full" ? "sm:inset-x-8" : ""}`}
      data-onboarding
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
            {step === "welcome" || step === "complete" ? "About a minute" : `Step ${step === "capacity" ? 1 : step === "capture" ? 2 : 3} of 3`}
          </p>
          <h2
            ref={headingRef}
            className="mb-0 mt-1 font-heading text-xl font-semibold leading-tight tracking-tight outline-none"
            id="onboarding-heading"
            tabIndex={-1}
          >
            {step === "welcome" ? "Make today realistic." : null}
            {step === "capacity" ? "How much focused work fits in a day?" : null}
            {step === "capture" ? "Capture something you actually need to do." : null}
            {step === "commit" ? "Give it a time cost." : null}
            {step === "complete" ? "You’ve made your first plan." : null}
          </h2>
        </div>
        {step !== "complete" ? (
          <Button aria-label="I’ll explore on my own" disabled={saveSettings.isPending} onClick={handleSkip} size="sm" type="button" variant="ghost">
            Skip
          </Button>
        ) : null}
      </div>

      {step === "welcome" ? (
        <>
          <p className="mb-0 mt-2 max-w-[48ch] text-sm leading-5 text-muted-foreground">
            Slate helps you see what your work costs before you commit to it. We’ll make one real plan together.
          </p>
          <Button className="mt-4" onClick={() => setStep("capacity")} type="button">
            Start planning
          </Button>
        </>
      ) : null}

      {step === "capacity" ? (
        <div className="mt-3">
          <p className="mb-0 text-sm leading-5 text-muted-foreground">
            Start with 240 minutes, or choose a number that feels realistic. You can change this anytime in Settings.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium" htmlFor="onboarding-capacity">
              Daily capacity
              <Input
                aria-describedby={capacityError ? "onboarding-capacity-error" : undefined}
                aria-invalid={capacityError ? true : undefined}
                autoFocus
                className="h-9"
                id="onboarding-capacity"
                min="1"
                onChange={(event) => setCapacityDraft(event.target.value)}
                type="number"
                value={capacityDraft}
              />
            </label>
            <span className="pb-2 text-sm text-muted-foreground">minutes</span>
            <Button disabled={saveSettings.isPending} onClick={handleConfirmCapacity} type="button">
              {saveSettings.isPending ? "Saving…" : "Use this capacity"}
            </Button>
          </div>
          {capacityError ? (
            <p className="mb-0 mt-2 text-sm text-destructive" id="onboarding-capacity-error" role="alert">
              {capacityError}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "capture" ? (
        <>
          <p className="mb-0 mt-2 max-w-[48ch] text-sm leading-5 text-muted-foreground">
            Backlog is where work waits before you decide whether it belongs in Today.
          </p>
          {pathname !== "/backlog" ? (
            <Button className="mt-4" onClick={handleOpenBacklog} type="button">
              Open Backlog
            </Button>
          ) : (
            <p className="mb-0 mt-4 text-sm font-medium text-foreground">Add a task in the composer below.</p>
          )}
        </>
      ) : null}

      {step === "commit" ? (
        <>
          <p className="mb-0 mt-2 max-w-[48ch] text-sm leading-5 text-muted-foreground">
            A rough estimate is enough. Set the time, choose Today, and save the task to see what remains.
          </p>
          {pathname !== "/backlog" ? (
            <Button className="mt-4" onClick={handleOpenBacklog} type="button" variant="outline">
              Open Backlog
            </Button>
          ) : (
            <p className="mb-0 mt-4 text-sm font-medium text-foreground">Use the selected task’s Set time and Set date controls below.</p>
          )}
        </>
      ) : null}

      {step === "complete" ? (
        <>
          <p className="mb-0 mt-2 max-w-[48ch] text-sm leading-5 text-muted-foreground">
            Capture more work in Backlog, then bring only what fits into Today.
          </p>
          <Button className="mt-4" onClick={handleContinue} type="button">
            Continue
          </Button>
        </>
      ) : null}
    </section>
  );
}
