import { useState, useEffect, useCallback, useRef } from 'react';

import { api } from '../api/axios';
import { ActivityLog, PaginatedResponse } from '../types';
import { useNetworkStatus } from './useNetworkStatus';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityFilters {
  userId?: string;
  entityId?: string;
  entityType?: string;
}

interface UseActivityFeedOptions {
  filters?: ActivityFilters;
  /** Polling interval in ms. Set to 0 to disable. Default: 15_000 */
  pollInterval?: number;
  limit?: number;
  autoStart?: boolean;
}

interface UseActivityFeedReturn {
  activities: ActivityLog[];
  total: number;
  isLoading: boolean;
  isFetchingMore: boolean;
  error: string | null;
  hasNextPage: boolean;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Load next page */
  loadMore: () => Promise<void>;
  /** Stop polling */
  stopPolling: () => void;
  /** Resume polling */
  startPolling: () => void;
}

// ─── API Helper ───────────────────────────────────────────────────────────────

interface ActivityResponse {
  data: ActivityLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

async function fetchActivity(
  filters: ActivityFilters,
  page: number,
  limit: number,
): Promise<ActivityResponse> {
  const { data } = await api.get<ActivityResponse>('/activity', {
    params: { ...filters, page, limit },
  });
  return data;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActivityFeed(options: UseActivityFeedOptions = {}): UseActivityFeedReturn {
  const {
    filters = {},
    pollInterval = 15_000,
    limit = 20,
    autoStart = true,
  } = options;

  const { isOnline } = useNetworkStatus();

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(autoStart);
  const isMountedRef = useRef(true);

  // Stable filter ref to avoid re-renders triggering poll restart
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Core fetch (page 1, replaces list) ─────────────────────────────────────

  const fetchFirst = useCallback(
    async (silent = false): Promise<void> => {
      if (!isOnline) return;
      if (!silent && isMountedRef.current) setIsLoading(true);
      setError(null);

      try {
        const response = await fetchActivity(filtersRef.current, 1, limit);
        if (!isMountedRef.current) return;

        setActivities(response.data);
        setTotal(response.meta.total);
        setCurrentPage(1);
        setHasNextPage(response.meta.page < response.meta.pages);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message = err instanceof Error ? err.message : 'Failed to load activity';
        setError(message);
      } finally {
        if (isMountedRef.current && !silent) setIsLoading(false);
      }
    },
    [isOnline, limit],
  );

  // ── Load more (pagination) ──────────────────────────────────────────────────

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasNextPage || isFetchingMore || !isOnline) return;

    setIsFetchingMore(true);

    try {
      const nextPage = currentPage + 1;
      const response = await fetchActivity(filtersRef.current, nextPage, limit);

      if (!isMountedRef.current) return;

      // Deduplicate by id before appending
      setActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const fresh = response.data.filter((a) => !existingIds.has(a.id));
        return [...prev, ...fresh];
      });
      setCurrentPage(nextPage);
      setHasNextPage(nextPage < response.meta.pages);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load more activity';
      setError(message);
    } finally {
      if (isMountedRef.current) setIsFetchingMore(false);
    }
  }, [hasNextPage, isFetchingMore, currentPage, limit, isOnline]);

  // ── Public refresh ──────────────────────────────────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    await fetchFirst(false);
  }, [fetchFirst]);

  // ── Polling control ─────────────────────────────────────────────────────────

  const stopPolling = useCallback((): void => {
    isPollingRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((): void => {
    if (pollInterval <= 0) return;
    isPollingRef.current = true;

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (isPollingRef.current && isOnline) {
        // Silent refresh — doesn't show loading spinner
        fetchFirst(true);
      }
    }, pollInterval);
  }, [pollInterval, fetchFirst, isOnline]);

  // ── Setup: initial fetch + polling ─────────────────────────────────────────

  useEffect(() => {
    if (autoStart) {
      fetchFirst(false);
    }

    if (autoStart && pollInterval > 0) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Re-fetch when online is restored
  useEffect(() => {
    if (isOnline) {
      fetchFirst(true);
      if (isPollingRef.current) {
        startPolling();
      }
    } else {
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return {
    activities,
    total,
    isLoading,
    isFetchingMore,
    error,
    hasNextPage,
    refresh,
    loadMore,
    stopPolling,
    startPolling,
  };
}
