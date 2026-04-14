import { useEffect, useCallback, useRef } from 'react';

import { useAI } from './useAI';
import { useAuthStore } from '../store/auth.store';
import { ActivitySummary, BlockerReport } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseAISummaryOptions {
  /** Period for activity summary. Default: 'day' */
  period?: ActivitySummary['period'];
  /** Task IDs with blocked status to analyse */
  blockedTaskIds?: string[];
  /** Auto-fetch on mount. Default: true */
  autoFetch?: boolean;
}

export interface UseAISummaryReturn {
  // Activity summary
  activitySummary: ActivitySummary | null;
  isActivityLoading: boolean;
  activityError: string | null;

  // Blocker report (first/most severe blocker)
  blockerReport: BlockerReport | null;
  isBlockerLoading: boolean;
  blockerError: string | null;

  // Combined loading state
  isLoading: boolean;
  hasBlockers: boolean;

  // Refresh
  refresh: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAISummary(
  options: UseAISummaryOptions = {},
): UseAISummaryReturn {
  const {
    period = 'day',
    blockedTaskIds = [],
    autoFetch = true,
  } = options;

  const user = useAuthStore((s) => s.user);

  const {
    activitySummary,
    isActivitySummaryLoading,
    activitySummaryError,
    getActivitySummary,

    blockerReport,
    isBlockerLoading,
    blockerError,
    analyzeBlocker,
  } = useAI();

  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Core fetch ──────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;

    // Fetch activity summary
    await getActivitySummary(user.id, period);

    // Analyse first blocked task (if any)
    if (blockedTaskIds.length > 0) {
      const firstBlockedId = blockedTaskIds[0];
      await analyzeBlocker(
        firstBlockedId,
        'Task is currently blocked — please analyse and suggest resolution actions.',
      );
    }
  }, [user?.id, period, blockedTaskIds, getActivitySummary, analyzeBlocker]);

  // ── Auto-fetch on mount ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  // ── Re-fetch when user or period changes ────────────────────────────────────

  useEffect(() => {
    if (!autoFetch) return;
    hasFetchedRef.current = false;
    fetchAll();
    hasFetchedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, period]);

  return {
    activitySummary,
    isActivityLoading: isActivitySummaryLoading,
    activityError: activitySummaryError,

    blockerReport,
    isBlockerLoading,
    blockerError,

    isLoading: isActivitySummaryLoading || isBlockerLoading,
    hasBlockers: blockedTaskIds.length > 0,

    refresh: fetchAll,
  };
}
