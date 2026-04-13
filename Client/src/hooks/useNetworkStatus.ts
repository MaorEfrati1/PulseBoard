import { useState, useEffect, useCallback } from 'react';

import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';

import { NetworkStatus } from '../types';

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
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online');
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

  // ── Subscribe to network changes ───────────────────────────────────────────

  useEffect(() => {
    // Fetch initial state immediately
    NetInfo.fetch().then((state) => {
      setNetworkStatus(resolveStatus(state));
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    const unsubscribe: NetInfoSubscription = NetInfo.addEventListener((state) => {
      setNetworkStatus(resolveStatus(state));
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    return () => {
      unsubscribe();
    };
  }, [resolveStatus]);

  // ── Manual recheck ─────────────────────────────────────────────────────────

  const recheck = useCallback(async (): Promise<void> => {
    const state = await NetInfo.fetch();
    setNetworkStatus(resolveStatus(state));
    setIsInternetReachable(state.isInternetReachable ?? true);
  }, [resolveStatus]);

  return {
    networkStatus,
    isOnline: networkStatus === 'online',
    isOffline: networkStatus === 'offline',
    isReconnecting: networkStatus === 'reconnecting',
    isInternetReachable,
    recheck,
  };
}
