import { useEffect, useState, type ReactNode } from "react";
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
  deleteApiKey,
  deleteTask,
  acceptDailyPlan,
  generateAiAssist,
  generateDailyPlan,
  getPlannerSnapshot,
  isTauriWindow,
  reorderTasks,
  setApiKey,
  setTaskCompleted,
  setTaskScheduledDate,
  updateSettings,
  updateTask,
  type PlannerPlanAssignment,
  type AiAssistInput,
  type AiPlanAcceptanceInput,
  type ReorderTasksInput,
  type SetTaskCompletedInput,
  type SetTaskScheduledDateInput,
  type Settings,
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

export function useUpdateSettings() {
  return usePlannerMutation<Settings>(updateSettings);
}

export function useApplyPlannerPlan() {
  return usePlannerMutation<PlannerPlanAssignment[]>(applyPlannerPlan);
}

export function useSetApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: Settings["aiProvider"]; apiKey: string }) =>
      setApiKey(provider, apiKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: plannerStateQueryKey }),
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: Settings["aiProvider"]) => deleteApiKey(provider),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: plannerStateQueryKey }),
  });
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
