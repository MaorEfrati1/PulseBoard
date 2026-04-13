import { useState, useEffect, useCallback, useRef } from 'react';

import tasksApi, {
  CreateTaskPayload,
  UpdateTaskPayload,
} from '../api/tasks.api';
import {
  Task,
  TaskFilters,
  PaginatedResponse,
  QueuedAction,
  QueuedActionType,
} from '../types';
import { useNetworkStatus } from './useNetworkStatus';

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const TASKS_CACHE_KEY = 'tasks_cache';
const QUEUE_KEY = 'offline_queue';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseTasksOptions {
  filters?: TaskFilters;
  page?: number;
  pageSize?: number;
  autoFetch?: boolean;
}

interface UseTasksReturn {
  tasks: Task[];
  total: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<Task | null>;
  updateTask: (id: string, payload: UpdateTaskPayload) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

// ─── Offline Queue Helpers ────────────────────────────────────────────────────

async function loadQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedAction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function enqueue(
  type: QueuedActionType,
  endpoint: string,
  payload?: unknown,
): Promise<void> {
  const queue = await loadQueue();
  const action: QueuedAction = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    endpoint,
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
  };
  queue.push(action);
  await saveQueue(queue);
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

async function loadCachedTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

async function cacheTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTasks(options: UseTasksOptions = {}): UseTasksReturn {
  const {
    filters,
    page: initialPage = 1,
    pageSize = 20,
    autoFetch = true,
  } = options;

  const { isOnline } = useNetworkStatus();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if the component is still mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetch = useCallback(async () => {
    if (!isMountedRef.current) return;

    // Offline — serve from cache
    if (!isOnline) {
      const cached = await loadCachedTasks();
      if (isMountedRef.current) {
        setTasks(cached);
        setTotal(cached.length);
        setHasNextPage(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: PaginatedResponse<Task> = await tasksApi.getAll(
        filters,
        initialPage,
        pageSize,
      );

      if (!isMountedRef.current) return;

      setTasks(response.data);
      setTotal(response.total);
      setHasNextPage(response.hasNextPage);
      setCurrentPage(initialPage);

      // Cache for offline use
      await cacheTasks(response.data);
    } catch (err) {
      if (!isMountedRef.current) return;

      const message = err instanceof Error ? err.message : 'Failed to fetch tasks';
      setError(message);

      // Fallback to cache on error
      const cached = await loadCachedTasks();
      if (cached.length > 0) {
        setTasks(cached);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [filters, initialPage, pageSize, isOnline]);

  // ── Fetch next page (pagination) ────────────────────────────────────────────

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetching || !isOnline) return;

    setIsFetching(true);

    try {
      const nextPage = currentPage + 1;
      const response: PaginatedResponse<Task> = await tasksApi.getAll(
        filters,
        nextPage,
        pageSize,
      );

      if (!isMountedRef.current) return;

      setTasks((prev) => [...prev, ...response.data]);
      setTotal(response.total);
      setHasNextPage(response.hasNextPage);
      setCurrentPage(nextPage);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to fetch more tasks';
      setError(message);
    } finally {
      if (isMountedRef.current) setIsFetching(false);
    }
  }, [hasNextPage, isFetching, currentPage, filters, pageSize, isOnline]);

  // ── Create ──────────────────────────────────────────────────────────────────

  const createTask = useCallback(
    async (payload: CreateTaskPayload): Promise<Task | null> => {
      if (!isOnline) {
        // Queue for later sync
        await enqueue('create', '/tasks', payload);

        // Optimistic local task (no real id yet)
        const optimistic: Task = {
          id: `optimistic_${Date.now()}`,
          title: payload.title,
          description: payload.description,
          status: 'todo',
          priority: payload.priority,
          assigneeId: payload.assigneeId,
          dueDate: payload.dueDate,
          tags: payload.tags ?? [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setTasks((prev) => [optimistic, ...prev]);
        return optimistic;
      }

      try {
        const created = await tasksApi.create(payload);
        setTasks((prev) => [created, ...prev]);
        setTotal((prev) => prev + 1);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create task';
        setError(message);
        return null;
      }
    },
    [isOnline],
  );

  // ── Update ──────────────────────────────────────────────────────────────────

  const updateTask = useCallback(
    async (id: string, payload: UpdateTaskPayload): Promise<Task | null> => {
      if (!isOnline) {
        await enqueue('update', `/tasks/${id}`, payload);

        // Optimistic update
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, ...payload, updatedAt: new Date().toISOString() } : t,
          ),
        );
        return null;
      }

      try {
        const updated = await tasksApi.update(id, payload);
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update task';
        setError(message);
        return null;
      }
    },
    [isOnline],
  );

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteTask = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isOnline) {
        await enqueue('delete', `/tasks/${id}`);

        // Optimistic removal
        setTasks((prev) => prev.filter((t) => t.id !== id));
        return true;
      }

      try {
        await tasksApi.remove(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setTotal((prev) => prev - 1);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete task';
        setError(message);
        return false;
      }
    },
    [isOnline],
  );

  // ── Refresh (alias for fetch) ───────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setCurrentPage(initialPage);
    await fetch();
  }, [fetch, initialPage]);

  // ── Auto-fetch on mount / filter change ────────────────────────────────────

  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  // Re-fetch when coming back online
  useEffect(() => {
    if (isOnline && tasks.length === 0) {
      fetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return {
    tasks,
    total,
    hasNextPage,
    isLoading,
    isFetching,
    error,
    fetch,
    fetchNextPage,
    createTask,
    updateTask,
    deleteTask,
    refresh,
  };
}
