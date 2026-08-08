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
  createTask,
  deleteTask,
  acceptDailyPlan,
  generateAiAssist,
  generateDailyPlan,
  getPlannerSnapshot,
  isTauriWindow,
  moveTask,
  reorderTasks,
  saveSettings,
  setTaskCompleted,
  setTaskScheduledDate,
  undoQuickCapture,
  updateTask,
  type PlannerSnapshot,
  type AiAssistInput,
  type AiPlanAcceptanceInput,
  type ReorderTasksInput,
  type SaveSettingsInput,
  type SetTaskCompletedInput,
  type SetTaskScheduledDateInput,
  type TaskInput,
  type UpdateTaskInput,
  type DeleteTaskInput,
  type MoveTaskInput,
  type UndoQuickCaptureInput,
} from "@/lib/planner";

export const plannerStateQueryKey = ["plannerState"] as const;

export function PlannerQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
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
    const invalidate = () => {
      void invalidatePlannerState(queryClient);
    };
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

function invalidatePlannerState(queryClient: QueryClient) {
  return queryClient.invalidateQueries(
    { queryKey: plannerStateQueryKey },
    { cancelRefetch: false },
  );
}

function usePlannerMutation<TInput, TOutput = void>(mutationFn: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => invalidatePlannerState(queryClient),
    onError: () => invalidatePlannerState(queryClient),
  });
}

export function useCreateTask() {
  return usePlannerMutation<TaskInput, Awaited<ReturnType<typeof createTask>>>(createTask);
}

export function useUndoQuickCapture() {
  return usePlannerMutation<UndoQuickCaptureInput>(undoQuickCapture);
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

export function useMoveTask() {
  return usePlannerMutation<MoveTaskInput, Awaited<ReturnType<typeof moveTask>>>(moveTask);
}

export function useDeleteTask() {
  return usePlannerMutation<DeleteTaskInput>(deleteTask);
}

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderTasks,
    onMutate: async (input: ReorderTasksInput) => {
      await queryClient.cancelQueries({ queryKey: plannerStateQueryKey });

      const previousSnapshot = queryClient.getQueryData<PlannerSnapshot>(plannerStateQueryKey);

      queryClient.setQueryData<PlannerSnapshot>(plannerStateQueryKey, (snapshot) => {
        if (!snapshot) {
          return snapshot;
        }

        return {
          ...snapshot,
          orderByScope: {
            ...snapshot.orderByScope,
            [input.scope]: input.taskIds,
          },
        };
      });

      return { previousSnapshot };
    },
    onError: (_error, _input, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(plannerStateQueryKey, context.previousSnapshot);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: plannerStateQueryKey }),
  });
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
