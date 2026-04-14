import { useState, useEffect, useCallback, useRef } from 'react';

import { socketService, SocketEvent } from '../services/socket.service';
import { useSocket } from './useSocket';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnlineUser {
  userId: string;
  userName: string;
  online: boolean;
  action: 'connected' | 'disconnected' | 'joined' | 'left';
  taskId?: string;
  lastSeen?: string;
}

interface UseOnlinePresenceReturn {
  onlineUsers: Map<string, OnlineUser>;
  onlineUserIds: string[];
  isUserOnline: (userId: string) => boolean;
  getOnlineCount: () => number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 20_000; // 20s — keeps Redis TTL (30s) alive

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnlinePresence(): UseOnlinePresenceReturn {
  const { isConnected, emit, on, off } = useSocket({ autoConnect: false });

  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(
    new Map(),
  );

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Handle incoming presence:update events ──────────────────────────────────

  const handlePresenceUpdate = useCallback((data: OnlineUser) => {
    if (!isMountedRef.current) return;

    setOnlineUsers((prev) => {
      const next = new Map(prev);

      if (data.online) {
        next.set(data.userId, {
          ...data,
          lastSeen: new Date().toISOString(),
        });
      } else {
        // User disconnected — mark offline but keep in map for UI display
        const existing = next.get(data.userId);
        if (existing) {
          next.set(data.userId, {
            ...existing,
            online: false,
            action: 'disconnected',
            lastSeen: new Date().toISOString(),
          });
        }
      }

      return next;
    });
  }, []);

  // ── Subscribe / unsubscribe to presence events ──────────────────────────────

  useEffect(() => {
    const event = 'presence:update' as SocketEvent;
    on<OnlineUser>(event, handlePresenceUpdate);

    return () => {
      off<OnlineUser>(event, handlePresenceUpdate);
    };
  }, [on, off, handlePresenceUpdate]);

  // ── Heartbeat — keeps Redis online TTL alive ────────────────────────────────

  useEffect(() => {
    if (!isConnected) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    // Send immediately on connect
    emit('presence:heartbeat' as SocketEvent);

    heartbeatRef.current = setInterval(() => {
      emit('presence:heartbeat' as SocketEvent);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isConnected, emit]);

  // ── Derived helpers ─────────────────────────────────────────────────────────

  const onlineUserIds = Array.from(onlineUsers.entries())
    .filter(([, u]) => u.online)
    .map(([id]) => id);

  const isUserOnline = useCallback(
    (userId: string): boolean => {
      return onlineUsers.get(userId)?.online === true;
    },
    [onlineUsers],
  );

  const getOnlineCount = useCallback((): number => {
    return onlineUserIds.length;
  }, [onlineUserIds]);

  return {
    onlineUsers,
    onlineUserIds,
    isUserOnline,
    getOnlineCount,
  };
}
