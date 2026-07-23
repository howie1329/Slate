import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useGenerateAiAssist } from "@/lib/planner-query";
import type { AiAssistProposal, LocalDate } from "@/lib/planner";

export type AiErrorCategory =
  | "unavailable-key"
  | "timeout"
  | "network"
  | "provider-rejected"
  | "malformed-output"
  | "no-proposal"
  | "internal";

type AssistIdentity = {
  originalCapture: string;
  scheduledDate: LocalDate | null;
  requestId: number;
};

export type AiReviewState =
  | { kind: "idle" }
  | ({ kind: "assist-loading" } & AssistIdentity)
  | ({ kind: "assist"; proposal: AiAssistProposal } & AssistIdentity)
  | ({ kind: "assist-error"; category: AiErrorCategory } & AssistIdentity)
  | ({ kind: "unavailable"; mode: "assist" } & AssistIdentity)
  | { kind: "unavailable"; mode: "plan" };

type AiReviewContextValue = {
  dismiss: () => void;
  redoAssist: () => void;
  showPlanUnavailable: () => void;
  startAssist: (capture: string, scheduledDate: LocalDate | null) => void;
  state: AiReviewState;
};

const AiReviewContext = createContext<AiReviewContextValue | null>(null);

export function AiReviewProvider({ children }: { children: ReactNode }) {
  const generateAiAssist = useGenerateAiAssist();
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

  const showPlanUnavailable = useCallback(() => {
    requestIdRef.current += 1;
    setState({ kind: "unavailable", mode: "plan" });
  }, []);

  const value = useMemo(
    () => ({ dismiss, redoAssist, showPlanUnavailable, startAssist, state }),
    [dismiss, redoAssist, showPlanUnavailable, startAssist, state],
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
    message === "unavailable-key" ||
    message === "timeout" ||
    message === "network" ||
    message === "provider-rejected" ||
    message === "malformed-output" ||
    message === "no-proposal" ||
    message === "internal"
  ) {
    return message;
  }

  return "internal";
}
