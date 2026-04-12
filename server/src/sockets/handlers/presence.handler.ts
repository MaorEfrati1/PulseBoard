import type { Server, Socket } from 'socket.io';
import { redisService } from '../../config/redis';
import { logger } from '../../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────
const ONLINE_TTL = 30; // seconds — matches heartbeat interval expectation

// ─── Payload Types ────────────────────────────────────────────────────────────

interface RoomPayload {
  taskId: string;
}

interface TypingPayload {
  taskId: string;
}

// ─── Register Handler ─────────────────────────────────────────────────────────

export function registerPresenceHandler(io: Server, socket: Socket): void {
  // ── room:join ─────────────────────────────────────────────────────────────
  socket.on('room:join', async ({ taskId }: RoomPayload): Promise<void> => {
    if (!taskId) return;

    const room = `task:${taskId}`;
    await socket.join(room);

    logger.debug('[presence] room:join', { userId: socket.userId, room });

    // Notify others in the room that this user joined
    socket.to(room).emit('presence:update', {
      userId: socket.userId,
      userName: socket.userName,
      online: true,
      action: 'joined',
      taskId,
    });
  });

  // ── room:leave ────────────────────────────────────────────────────────────
  socket.on('room:leave', async ({ taskId }: RoomPayload): Promise<void> => {
    if (!taskId) return;

    const room = `task:${taskId}`;
    await socket.leave(room);

    logger.debug('[presence] room:leave', { userId: socket.userId, room });

    socket.to(room).emit('presence:update', {
      userId: socket.userId,
      userName: socket.userName,
      online: true, // still connected, just left the room
      action: 'left',
      taskId,
    });
  });

  // ── typing:start ──────────────────────────────────────────────────────────
  socket.on('typing:start', ({ taskId }: TypingPayload): void => {
    if (!taskId) return;

    const room = `task:${taskId}`;
    socket.to(room).emit('typing:update', {
      userId: socket.userId,
      userName: socket.userName,
      isTyping: true,
      taskId,
    });
  });

  // ── typing:stop ───────────────────────────────────────────────────────────
  socket.on('typing:stop', ({ taskId }: TypingPayload): void => {
    if (!taskId) return;

    const room = `task:${taskId}`;
    socket.to(room).emit('typing:update', {
      userId: socket.userId,
      userName: socket.userName,
      isTyping: false,
      taskId,
    });
  });

  // ── presence:heartbeat ────────────────────────────────────────────────────
  // Client should emit this every ~20s to keep the online TTL alive (TTL = 30s).
  socket.on('presence:heartbeat', async (): Promise<void> => {
    try {
      await redisService.setOnline(socket.userId, ONLINE_TTL);
    } catch (err) {
      logger.warn('[presence] heartbeat Redis error', { error: (err as Error).message });
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', async (reason: string): Promise<void> => {
    logger.info('[presence] disconnect', { userId: socket.userId, reason });

    try {
      await redisService.deleteOnline(socket.userId);
    } catch (err) {
      logger.warn('[presence] deleteOnline error', { error: (err as Error).message });
    }

    // Broadcast offline status to everyone (personal room listeners + global)
    io.emit('presence:update', {
      userId: socket.userId,
      userName: socket.userName,
      online: false,
      action: 'disconnected',
    });
  });
}
