import { useEffect, useRef, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  applyPlannerPlan,
  createTask,
  deleteTask,
  acceptDailyPlan,
  generateAiAssist,
  generateDailyPlan,
  getPlannerSnapshot,
  isTauriWindow,
  reorderTasks,
  saveSettings,
  setTaskCompleted,
  setTaskScheduledDate,
  updateTask,
  type PlannerPlanAssignment,
  type PlannerSnapshot,
  type AiAssistInput,
  type AiPlanAcceptanceInput,
  type ReorderTasksInput,
  type SaveSettingsInput,
  type SetTaskCompletedInput,
  type SetTaskScheduledDateInput,
  type TaskInput,
  type UpdateTaskInput,
} from "@/lib/planner";

export const plannerStateQueryKey = ["plannerState"] as const;

export function PlannerQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PlannerChangeListener />
      {children}
    </QueryClientProvider>
  );
}

function PlannerChangeListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: plannerStateQueryKey });
    window.addEventListener("focus", invalidate);

    if (!isTauriWindow()) {
      return () => window.removeEventListener("focus", invalidate);
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;

    void listen("planner://changed", invalidate).then((stopListening) => {
      if (disposed) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    });

    return () => {
      disposed = true;
      window.removeEventListener("focus", invalidate);
      unlisten?.();
    };
  }, [queryClient]);

  return null;
}

export function usePlannerState() {
  return useQuery({
    queryKey: plannerStateQueryKey,
    queryFn: getPlannerSnapshot,
  });
}

function usePlannerMutation<TInput>(mutationFn: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: plannerStateQueryKey }),
  });
}

export function useCreateTask() {
  return usePlannerMutation<TaskInput>(createTask);
}

export function useUpdateTask() {
  return usePlannerMutation<UpdateTaskInput>(updateTask);
}

export function useSetTaskCompleted() {
  return usePlannerMutation<SetTaskCompletedInput>(setTaskCompleted);
}

export function useSetTaskScheduledDate() {
  return usePlannerMutation<SetTaskScheduledDateInput>(setTaskScheduledDate);
}

export function useDeleteTask() {
  return usePlannerMutation<string>(deleteTask);
}

export function useReorderTasks() {
  return usePlannerMutation<ReorderTasksInput>(reorderTasks);
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  return {
    isPending,
    mutate: (
      input: SaveSettingsInput,
      options?: {
        onSuccess?: (snapshot: PlannerSnapshot) => void;
        onError?: (error: unknown) => void;
      },
    ) => {
      if (pendingRef.current) {
        return;
      }

      pendingRef.current = true;
      setIsPending(true);
      void saveSettings(input)
        .then((snapshot) => {
          queryClient.setQueryData<PlannerSnapshot>(plannerStateQueryKey, snapshot);
          options?.onSuccess?.(snapshot);
        })
        .catch((error: unknown) => options?.onError?.(error))
        .finally(() => {
          pendingRef.current = false;
          setIsPending(false);
        });
    },
  };
}

export function useApplyPlannerPlan() {
  return usePlannerMutation<PlannerPlanAssignment[]>(applyPlannerPlan);
}

export function useGenerateAiAssist() {
  return useMutation({
    mutationFn: (input: AiAssistInput) => generateAiAssist(input),
  });
}

export function useGenerateDailyPlan() {
  return useMutation({
    mutationFn: () => generateDailyPlan(),
  });
}

export function useAcceptDailyPlan() {
  return usePlannerMutation<AiPlanAcceptanceInput>(acceptDailyPlan);
}
