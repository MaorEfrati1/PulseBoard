import { useState, useEffect, useCallback, useRef } from 'react';

import { socketService, SocketEvent, SocketStatus } from '../services/socket.service';
import { useAuthStore } from '../store/auth.store';
import { useNetworkStatus } from './useNetworkStatus';

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL =
  (process.env.EXPO_PUBLIC_SOCKET_URL as string | undefined) ??
  'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSocketOptions {
  /** Auto-connect on mount when authenticated. Default: true */
  autoConnect?: boolean;
}

interface UseSocketReturn {
  status: SocketStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: <T = unknown>(event: SocketEvent, data?: T) => void;
  on: <T = unknown>(event: SocketEvent, handler: (data: T) => void) => void;
  off: <T = unknown>(event: SocketEvent, handler?: (data: T) => void) => void;
  joinRoom: (taskId: string) => void;
  leaveRoom: (taskId: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true } = options;

  const { isAuthenticated, tokens } = useAuthStore();
  const { isOnline } = useNetworkStatus();

  const [status, setStatus] = useState<SocketStatus>(socketService.status);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Status listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    const onConnect = () => {
      if (isMountedRef.current) setStatus('connected');
    };
    const onDisconnect = () => {
      if (isMountedRef.current) setStatus('disconnected');
    };
    const onError = () => {
      if (isMountedRef.current) setStatus('error');
    };
    const onConnecting = () => {
      if (isMountedRef.current) setStatus('connecting');
    };

    socketService.on('connect', onConnect);
    socketService.on('disconnect', onDisconnect);
    socketService.on('connect_error', onError);

    // Sync initial status in case socket was already connected before mount
    setStatus(socketService.status);

    return () => {
      socketService.off('connect', onConnect);
      socketService.off('disconnect', onDisconnect);
      socketService.off('connect_error', onError);
    };
  }, []);

  // ── Auto-connect: connect when authenticated + online ──────────────────────

  useEffect(() => {
    if (!autoConnect) return;

    if (isAuthenticated && tokens?.accessToken && isOnline) {
      if (!socketService.isConnected) {
        socketService.connect(SOCKET_URL, tokens.accessToken);
        setStatus('connecting');
      }
    } else if (!isAuthenticated) {
      // Disconnect on logout
      socketService.disconnect();
      setStatus('disconnected');
    }
  }, [autoConnect, isAuthenticated, tokens?.accessToken, isOnline]);

  // ── Public API ──────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!tokens?.accessToken) {
      console.warn('[useSocket] Cannot connect: no access token');
      return;
    }
    socketService.connect(SOCKET_URL, tokens.accessToken);
    setStatus('connecting');
  }, [tokens?.accessToken]);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    setStatus('disconnected');
  }, []);

  const emit = useCallback(
    <T = unknown>(event: SocketEvent, data?: T) => {
      socketService.emit(event, data);
    },
    [],
  );

  const on = useCallback(
    <T = unknown>(event: SocketEvent, handler: (data: T) => void) => {
      socketService.on<T>(event, handler);
    },
    [],
  );

  const off = useCallback(
    <T = unknown>(event: SocketEvent, handler?: (data: T) => void) => {
      socketService.off<T>(event, handler);
    },
    [],
  );

  const joinRoom = useCallback((taskId: string) => {
    socketService.joinRoom(taskId);
  }, []);

  const leaveRoom = useCallback((taskId: string) => {
    socketService.leaveRoom(taskId);
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
  };
}
