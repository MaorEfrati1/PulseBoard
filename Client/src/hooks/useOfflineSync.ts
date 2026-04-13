import { useState, useEffect, useCallback, useRef } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '../api/axios';
import { QueuedAction, SyncResult } from '../types';
import { useNetworkStatus } from './useNetworkStatus';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY = 'offline_queue';
const MAX_RETRIES = 3;

// ─── Queue persistence helpers ────────────────────────────────────────────────

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

// ─── Execute a single queued action against the REST API ─────────────────────

async function executeAction(action: QueuedAction): Promise<void> {
  switch (action.type) {
    case 'create':
      await api.post(action.endpoint, action.payload);
      break;
    case 'update':
      await api.patch(action.endpoint, action.payload);
      break;
    case 'delete':
      await api.delete(action.endpoint);
      break;
    default:
      throw new Error(`Unknown queued action type: ${(action as QueuedAction).type}`);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseOfflineSyncReturn {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncResult: SyncResult | null;
  /** Manually trigger sync (auto-triggered on reconnect) */
  sync: () => Promise<SyncResult>;
  /** Clear the entire queue (use with caution) */
  clearQueue: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineSync(): UseOfflineSyncReturn {
  const { isOnline } = useNetworkStatus();

  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const isSyncingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Refresh pending count on mount ──────────────────────────────────────────

  useEffect(() => {
    loadQueue().then((q) => {
      if (isMountedRef.current) setPendingCount(q.length);
    });
  }, []);

  // ── Core sync logic ─────────────────────────────────────────────────────────

  const sync = useCallback(async (): Promise<SyncResult> => {
    const result: SyncResult = { synced: 0, failed: 0, errors: [] };

    if (isSyncingRef.current) return result;

    const queue = await loadQueue();
    if (queue.length === 0) return result;

    isSyncingRef.current = true;
    if (isMountedRef.current) setIsSyncing(true);

    const remaining: QueuedAction[] = [];

    for (const action of queue) {
      try {
        await executeAction(action);
        result.synced += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const updatedRetries = action.retries + 1;

        if (updatedRetries < MAX_RETRIES) {
          // Keep in queue with incremented retry count
          remaining.push({ ...action, retries: updatedRetries });
        } else {
          // Permanently failed — log and discard
          result.failed += 1;
          result.errors.push({ actionId: action.id, message });
        }
      }
    }

    await saveQueue(remaining);

    isSyncingRef.current = false;

    if (isMountedRef.current) {
      setIsSyncing(false);
      setPendingCount(remaining.length);
      setLastSyncResult(result);
    }

    return result;
  }, []);

  // ── Clear queue ─────────────────────────────────────────────────────────────

  const clearQueue = useCallback(async (): Promise<void> => {
    await saveQueue([]);
    if (isMountedRef.current) {
      setPendingCount(0);
    }
  }, []);

  // ── Auto-sync when coming back online ──────────────────────────────────────

  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (isOnline && wasOffline) {
      // Small delay to let the connection stabilise before syncing
      const timeout = setTimeout(() => {
        sync();
      }, 1_500);

      return () => clearTimeout(timeout);
    }
  }, [isOnline, sync]);

  return {
    isSyncing,
    pendingCount,
    lastSyncResult,
    sync,
    clearQueue,
  };
}
