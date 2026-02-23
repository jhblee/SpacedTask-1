import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { ipc } from '../lib/ipc';

export const TASKS_QUERY_KEY = ['tasks'] as const;
export const TODAY_QUERY_KEY = ['today'] as const;

/** Shared QueryClient instance — exported so App can wrap with <QueryClientProvider> */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
    },
  },
});

/** Fetches the current local date from the main process (injectable for tests) */
export function useTodayLocal() {
  return useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => ipc.getTodayLocal(),
    staleTime: 30_000, // re-fetch at most every 30 s; day rarely changes mid-session
  });
}

/** Fetches all tasks */
export function useTasks() {
  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: () => ipc.getTasks(),
  });
}

/** Mutation: create a new task */
export function useCreateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => ipc.createTask(title),
    onSuccess: () => client.invalidateQueries({ queryKey: TASKS_QUERY_KEY }),
  });
}

/** Mutation: mark a task completed for today */
export function useCompleteTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipc.completeTask(id),
    onSuccess: () => client.invalidateQueries({ queryKey: TASKS_QUERY_KEY }),
  });
}

/** Mutation: reset a task to freshly-created state */
export function useResetTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipc.resetTask(id),
    onSuccess: () => client.invalidateQueries({ queryKey: TASKS_QUERY_KEY }),
  });
}

/** Mutation: delete a task permanently */
export function useDeleteTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipc.deleteTask(id),
    onSuccess: () => client.invalidateQueries({ queryKey: TASKS_QUERY_KEY }),
  });
}
