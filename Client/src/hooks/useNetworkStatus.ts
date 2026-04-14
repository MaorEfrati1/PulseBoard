import { useState, useEffect, useCallback } from 'react';

import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';

import { NetworkStatus } from '../types';
import { useUIStore } from '../store/ui.store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseNetworkStatusReturn {
  networkStatus: NetworkStatus;
  isOnline: boolean;
  isOffline: boolean;
  isReconnecting: boolean;
  /** True when connected AND internet is actually reachable */
  isInternetReachable: boolean;
  /** Manually re-check network status */
  recheck: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNetworkStatus(): UseNetworkStatusReturn {
  const setNetworkStatus = useUIStore((s) => s.setNetworkStatus);

  const [networkStatus, setLocalStatus] = useState<NetworkStatus>('online');
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  // ── Resolve raw NetInfo state → our NetworkStatus type ─────────────────────

  const resolveStatus = useCallback((state: NetInfoState): NetworkStatus => {
    const connected = state.isConnected ?? false;
    const reachable = state.isInternetReachable ?? null;

    if (!connected) return 'offline';

    // Connected but internet reachability unknown or still being checked
    if (reachable === null) return 'reconnecting';

    return reachable ? 'online' : 'reconnecting';
  }, []);

  // ── Apply status to both local state and global store ──────────────────────

  const applyStatus = useCallback(
    (state: NetInfoState) => {
      const status = resolveStatus(state);
      setLocalStatus(status);
      setNetworkStatus(status);           // ← keep ui.store in sync
      setIsInternetReachable(state.isInternetReachable ?? true);
    },
    [resolveStatus, setNetworkStatus],
  );

  // ── Subscribe to network changes ───────────────────────────────────────────

  useEffect(() => {
    // Fetch initial state immediately
    NetInfo.fetch().then(applyStatus);

    const unsubscribe: NetInfoSubscription =
      NetInfo.addEventListener(applyStatus);

    return () => {
      unsubscribe();
    };
  }, [applyStatus]);

  // ── Manual recheck ─────────────────────────────────────────────────────────

  const recheck = useCallback(async (): Promise<void> => {
    const state = await NetInfo.fetch();
    applyStatus(state);
  }, [applyStatus]);

  return {
    networkStatus,
    isOnline: networkStatus === 'online',
    isOffline: networkStatus === 'offline',
    isReconnecting: networkStatus === 'reconnecting',
    isInternetReachable,
    recheck,
  };
}
