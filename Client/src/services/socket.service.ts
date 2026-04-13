import { io, Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SocketEvent =
  // Chat
  | 'message:send'
  | 'message:receive'
  // Presence
  | 'presence:update'
  | 'presence:heartbeat'
  // Rooms
  | 'room:join'
  | 'room:leave'
  // Typing
  | 'typing:start'
  | 'typing:stop'
  | 'typing:update'
  // Tasks
  | 'task:updated'
  // AI
  | 'ai:new_insight'
  // Errors
  | 'error'
  // Connection lifecycle
  | 'connect'
  | 'disconnect'
  | 'connect_error';

export type SocketStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

type EventCallback<T = unknown> = (data: T) => void;

// ─── Singleton ────────────────────────────────────────────────────────────────

class SocketService {
  private socket: Socket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /** Heartbeat must match server ONLINE_TTL (30s) — emit every 20s */
  private readonly HEARTBEAT_MS = 20_000;

  // ── Connect ────────────────────────────────────────────────────────────────

  connect(serverUrl: string, accessToken: string): void {
    // Already connected with same socket — no-op
    if (this.socket?.connected) return;

    // Cleanup stale socket before reconnecting
    if (this.socket) {
      this._cleanup();
    }

    this.socket = io(serverUrl, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 20_000,
    });

    this.socket.on('connect', () => {
      this._startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      this._stopHeartbeat();
    });
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  disconnect(): void {
    this._cleanup();
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  get status(): SocketStatus {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    if (this.socket.active) return 'connecting';
    return 'disconnected';
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }

  // ── Emit ───────────────────────────────────────────────────────────────────

  emit<T = unknown>(event: SocketEvent, data?: T): void {
    if (!this.socket?.connected) {
      console.warn(`[socket] Tried to emit "${event}" but socket is not connected`);
      return;
    }
    this.socket.emit(event, data);
  }

  // ── Listen ─────────────────────────────────────────────────────────────────

  on<T = unknown>(event: SocketEvent, callback: EventCallback<T>): void {
    this.socket?.on(event, callback as EventCallback);
  }

  off<T = unknown>(event: SocketEvent, callback?: EventCallback<T>): void {
    if (callback) {
      this.socket?.off(event, callback as EventCallback);
    } else {
      this.socket?.off(event);
    }
  }

  /** One-time listener */
  once<T = unknown>(event: SocketEvent, callback: EventCallback<T>): void {
    this.socket?.once(event, callback as EventCallback);
  }

  // ── Room helpers ───────────────────────────────────────────────────────────

  joinRoom(taskId: string): void {
    this.emit('room:join', { taskId });
  }

  leaveRoom(taskId: string): void {
    this.emit('room:leave', { taskId });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _startHeartbeat(): void {
    if (this.heartbeatInterval !== null) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('presence:heartbeat');
      }
    }, this.HEARTBEAT_MS);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private _cleanup(): void {
    this._stopHeartbeat();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}

// Export single instance — shared across entire app
export const socketService = new SocketService();
