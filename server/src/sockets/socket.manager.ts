import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { authService } from '../services/auth.service';
import { redisService } from '../config/redis';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { registerChatHandler, subscribeChatChannel } from './handlers/chat.handler';
import { registerPresenceHandler } from './handlers/presence.handler';

// ─── Constants ────────────────────────────────────────────────────────────────
const ONLINE_TTL = 30; // seconds

// ─── Exported io instance (for use in REST routes if needed) ──────────────────
export let io: SocketServer;

// ─── Main Initializer ─────────────────────────────────────────────────────────

export function initSocketServer(httpServer: HttpServer): SocketServer {
  // ── 1. Create Socket.io server ────────────────────────────────────────────
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Ping every 25s, timeout after 60s — works with 30s online TTL heartbeat
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });

  // ── 2. Redis adapter (horizontal scaling across nodes) ────────────────────
  const publisher = redisService.getPublisher();
  const subscriber = redisService.getSubscriber();
  io.adapter(createAdapter(publisher, subscriber));
  logger.info('[socket] Redis adapter attached');

  // ── 3. Auth middleware ────────────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      // Extract token from handshake (supports both auth object and query param)
      const token =
        socket.handshake.auth?.token ??
        (socket.handshake.query?.token as string | undefined);

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication error: token missing'));
      }

      // ── Verify JWT ────────────────────────────────────────────────────────
      let payload: { userId: string; role: string };
      try {
        payload = authService.verifyAccessToken(token);
      } catch {
        return next(new Error('Authentication error: invalid token'));
      }

      // ── Validate session in Redis ─────────────────────────────────────────
      const session = await redisService.getSession<{
        userId: string;
        role: string;
        email: string;
      }>(payload.userId);

      if (!session) {
        return next(new Error('Authentication error: session expired'));
      }

      // ── Fetch user name (needed for presence events) ──────────────────────
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { name: true },
      });

      if (!user) {
        return next(new Error('Authentication error: user not found'));
      }

      // ── Attach to socket ──────────────────────────────────────────────────
      socket.userId = payload.userId;
      socket.role = payload.role;
      socket.userName = user.name;

      next();
    } catch (err) {
      logger.error('[socket] Auth middleware error', { error: (err as Error).message });
      next(new Error('Authentication error: internal error'));
    }
  });

  // ── 4. Redis subscriptions (task updates + AI insights) ───────────────────
  _setupRedisSubscriptions();

  // ── 5. Chat channel subscriber (fan-out across nodes) ────────────────────
  subscribeChatChannel(io);

  // ── 6. Connection handler ─────────────────────────────────────────────────
  io.on('connection', async (socket: Socket) => {
    logger.info('[socket] Client connected', {
      socketId: socket.id,
      userId: socket.userId,
    });

    // ── Join personal room ────────────────────────────────────────────────
    await socket.join(`user:${socket.userId}`);

    // ── Mark user online in Redis (TTL 30s, renewed by heartbeat) ─────────
    try {
      await redisService.setOnline(socket.userId, ONLINE_TTL);
    } catch (err) {
      logger.warn('[socket] setOnline error', { error: (err as Error).message });
    }

    // ── Broadcast presence update to all connected clients ────────────────
    io.emit('presence:update', {
      userId: socket.userId,
      userName: socket.userName,
      online: true,
      action: 'connected',
    });

    // ── Register domain handlers ───────────────────────────────────────────
    registerChatHandler(io, socket);
    registerPresenceHandler(io, socket);
  });

  logger.info('[socket] Socket.io server initialised');
  return io;
}

// ─── Private: Redis Channel Subscriptions ─────────────────────────────────────

function _setupRedisSubscriptions(): void {
  // ── channel:task:updated → emit 'task:updated' to task room ──────────────
  redisService
    .subscribe(
      'channel:task:updated',
      (raw: unknown) => {
        try {
          const data = raw as {
            taskId: string;
            changes: Record<string, unknown>;
            updatedBy: string;
          };

          // Emit to the task-specific room so only relevant viewers get it
          io.to(`task:${data.taskId}`).emit('task:updated', data);

          logger.debug('[socket] task:updated emitted', { taskId: data.taskId });
        } catch (err) {
          logger.error('[socket] channel:task:updated parse error', {
            error: (err as Error).message,
          });
        }
      }
    )
    .catch((err) =>
      logger.error('[socket] Failed to subscribe to channel:task:updated', {
        error: err.message,
      })
    );

  // ── channel:ai:insight → emit 'ai:new_insight' to all clients ────────────
  // Triggered when the AI engine detects a blocker or generates an insight.
  redisService
    .subscribe(
      'channel:ai:insight',
      (raw: unknown) => {
        try {
          const data = raw as {
            taskId?: string;
            insight: string;
            severity?: string;
            [key: string]: unknown;
          };

          // Broadcast to everyone — AI insights are global notifications
          io.emit('ai:new_insight', data);

          logger.debug('[socket] ai:new_insight emitted', { taskId: data.taskId });
        } catch (err) {
          logger.error('[socket] channel:ai:insight parse error', {
            error: (err as Error).message,
          });
        }
      }
    )
    .catch((err) =>
      logger.error('[socket] Failed to subscribe to channel:ai:insight', {
        error: err.message,
      })
    );
}
