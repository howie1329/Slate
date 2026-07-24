import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAcceptDailyPlan, useGenerateAiAssist, useGenerateDailyPlan } from "@/lib/planner-query";
import type { AiAssistProposal, AiPlanProposal, LocalDate } from "@/lib/planner";

export type AiErrorCategory =
  | "unavailable-key"
  | "credentials-unavailable"
  | "timeout"
  | "network"
  | "provider-rejected"
  | "malformed-output"
  | "no-proposal"
  | "stale-plan"
  | "internal";

type AssistIdentity = {
  originalCapture: string;
  scheduledDate: LocalDate | null;
  requestId: number;
};

type PlanIdentity = { requestId: number };

export type AiReviewState =
  | { kind: "idle" }
  | ({ kind: "assist-loading" } & AssistIdentity)
  | ({ kind: "assist"; proposal: AiAssistProposal } & AssistIdentity)
  | ({ kind: "assist-error"; category: AiErrorCategory } & AssistIdentity)
  | ({ kind: "unavailable"; mode: "assist" } & AssistIdentity)
  | ({ kind: "plan-loading" } & PlanIdentity)
  | ({ kind: "plan"; proposal: AiPlanProposal } & PlanIdentity)
  | ({ kind: "plan-empty"; proposal: AiPlanProposal } & PlanIdentity)
  | ({ kind: "plan-accepting"; proposal: AiPlanProposal } & PlanIdentity)
  | ({ kind: "plan-error"; category: AiErrorCategory } & PlanIdentity)
  | ({ kind: "plan-stale"; proposal: AiPlanProposal } & PlanIdentity)
  | ({ kind: "unavailable"; mode: "plan" } & PlanIdentity);

type AiReviewContextValue = {
  acceptPlan: (proposal: AiPlanProposal) => void;
  dismiss: () => void;
  redoAssist: () => void;
  redoPlan: () => void;
  startAssist: (capture: string, scheduledDate: LocalDate | null) => void;
  startPlan: () => void;
  state: AiReviewState;
};

const AiReviewContext = createContext<AiReviewContextValue | null>(null);

export function AiReviewProvider({ children }: { children: ReactNode }) {
  const generateAiAssist = useGenerateAiAssist();
  const generateDailyPlan = useGenerateDailyPlan();
  const acceptDailyPlan = useAcceptDailyPlan();
  const [state, setState] = useState<AiReviewState>({ kind: "idle" });
  const requestIdRef = useRef(0);

  const dismiss = useCallback(() => {
    requestIdRef.current += 1;
    setState({ kind: "idle" });
  }, []);

  const startAssist = useCallback(
    (capture: string, scheduledDate: LocalDate | null) => {
      const originalCapture = capture.trim();
      if (!originalCapture) {
        return;
      }

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const identity = { originalCapture, scheduledDate, requestId };
      setState({ kind: "assist-loading", ...identity });
      generateAiAssist.mutate(
        { capture: originalCapture, scheduledDate },
        {
          onSuccess: (proposal) => {
            if (requestIdRef.current === requestId) {
              setState({ kind: "assist", ...identity, proposal });
            }
          },
          onError: (error) => {
            if (requestIdRef.current !== requestId) {
              return;
            }

            const category = errorCategory(error);
            if (category === "unavailable-key") {
              setState({ kind: "unavailable", mode: "assist", ...identity });
            } else {
              setState({ kind: "assist-error", ...identity, category });
            }
          },
        },
      );
    },
    [generateAiAssist],
  );

  const redoAssist = useCallback(() => {
    if (state.kind !== "assist" && state.kind !== "assist-error") {
      return;
    }

    startAssist(state.originalCapture, state.scheduledDate);
  }, [startAssist, state]);

  const startPlan = useCallback(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setState({ kind: "plan-loading", requestId });
    generateDailyPlan.mutate(undefined, {
      onSuccess: (proposal) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setState({ kind: proposal.items.length ? "plan" : "plan-empty", requestId, proposal });
      },
      onError: (error) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        const category = errorCategory(error);
        if (category === "unavailable-key") {
          setState({ kind: "unavailable", mode: "plan", requestId });
        } else {
          setState({ kind: "plan-error", category, requestId });
        }
      },
    });
  }, [generateDailyPlan]);

  const redoPlan = useCallback(() => {
    if (
      state.kind !== "plan"
      && state.kind !== "plan-empty"
      && state.kind !== "plan-error"
      && state.kind !== "plan-stale"
      && !(state.kind === "unavailable" && state.mode === "plan")
    ) {
      return;
    }

    startPlan();
  }, [startPlan, state]);

  const acceptPlan = useCallback(
    (proposal: AiPlanProposal) => {
      if (state.kind !== "plan" || proposal.items.length === 0) {
        return;
      }

      const requestId = state.requestId;
      setState({ kind: "plan-accepting", requestId, proposal });
      acceptDailyPlan.mutate(
        {
          items: proposal.items.map(({ id, title, estimateMinutes, sourceScheduledDate }) => ({
            id,
            title,
            estimateMinutes,
            sourceScheduledDate,
          })),
          todayTaskIds: proposal.todayTaskIds,
          expectedDailyCapacityMinutes: proposal.expectedDailyCapacityMinutes,
          expectedRemainingMinutes: proposal.expectedRemainingMinutes,
        },
        {
          onSuccess: () => {
            if (requestIdRef.current !== requestId) {
              return;
            }
            setState({ kind: "idle" });
            toast.success("Plan accepted.");
          },
          onError: (error) => {
            if (requestIdRef.current !== requestId) {
              return;
            }
            const category = errorCategory(error);
            if (category === "stale-plan") {
              setState({ kind: "plan-stale", requestId, proposal });
            } else {
              setState({ kind: "plan-error", requestId, category });
            }
          },
        },
      );
    },
    [acceptDailyPlan, state],
  );

  const value = useMemo(
    () => ({ acceptPlan, dismiss, redoAssist, redoPlan, startAssist, startPlan, state }),
    [acceptPlan, dismiss, redoAssist, redoPlan, startAssist, startPlan, state],
  );

  return <AiReviewContext.Provider value={value}>{children}</AiReviewContext.Provider>;
}

export function useAiReview() {
  const context = useContext(AiReviewContext);

  if (!context) {
    throw new Error("useAiReview must be used within AiReviewProvider.");
  }

  return context;
}

function errorCategory(error: unknown): AiErrorCategory {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (
    message === "unavailable-key"
    || message === "credentials-unavailable"
    || message === "timeout"
    || message === "network"
    || message === "provider-rejected"
    || message === "malformed-output"
    || message === "no-proposal"
    || message === "stale-plan"
    || message === "internal"
  ) {
    return message;
  }

  return "internal";
}
