import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database';
import { redisService } from '../../config/redis';
import { logger } from '../../utils/logger';

// ─── Channels ─────────────────────────────────────────────────────────────────
const CHANNEL_CHAT = 'channel:chat:message';

// ─── Payload Types ─────────────────────────────────────────────────────────────

interface MessageSendPayload {
  taskId: string;
  content: string;
}

interface MessageReceivePayload {
  id: string;
  taskId: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

// ─── Register Handler ─────────────────────────────────────────────────────────

export function registerChatHandler(_io: Server, socket: Socket): void {
  /**
   * message:send
   * Client sends { taskId, content }
   * → save to DB → Redis PUBLISH → room receives 'message:receive'
   */
  socket.on(
    'message:send',
    async (payload: MessageSendPayload): Promise<void> => {
      try {
        const { taskId, content } = payload;

        // ── Basic validation ────────────────────────────────────────────────
        if (!taskId || typeof taskId !== 'string') {
          socket.emit('error', { event: 'message:send', message: 'taskId is required' });
          return;
        }
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
          socket.emit('error', { event: 'message:send', message: 'content cannot be empty' });
          return;
        }

        // ── Verify task exists (lightweight — id only) ──────────────────────
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          select: { id: true },
        });

        if (!task) {
          socket.emit('error', { event: 'message:send', message: `Task ${taskId} not found` });
          return;
        }

        // ── Persist message to DB ────────────────────────────────────────────
        const message = await prisma.message.create({
          data: {
            taskId,
            senderId: socket.userId,
            content: content.trim(),
          },
          select: {
            id: true,
            taskId: true,
            senderId: true,
            content: true,
            createdAt: true,
            sender: {
              select: { name: true },
            },
          },
        });

        const outbound: MessageReceivePayload = {
          id: message.id,
          taskId: message.taskId,
          content: message.content,
          senderId: message.senderId,
          senderName: message.sender.name,
          createdAt: message.createdAt.toISOString(),
        };

        // ── Redis PUBLISH — fan-out to all socket.io nodes ──────────────────
        // Other nodes subscribed to this channel will emit to their local sockets.
        await redisService.publish(CHANNEL_CHAT, {
          room: `task:${taskId}`,
          message: outbound,
        });

        logger.debug('[chat] message:send published', {
          taskId,
          messageId: message.id,
          senderId: socket.userId,
        });
      } catch (err) {
        logger.error('[chat] message:send error', { error: (err as Error).message });
        socket.emit('error', { event: 'message:send', message: 'Failed to send message' });
      }
    }
  );
}

// ─── Redis Subscriber Setup ───────────────────────────────────────────────────

/**
 * Subscribe to the chat channel once at the manager level.
 * Called from socket.manager.ts during server initialisation.
 * Emits 'message:receive' to the correct task room on every node.
 */
export function subscribeChatChannel(io: Server): void {
  redisService
    .subscribe(CHANNEL_CHAT, (raw: unknown) => {
      try {
        const data = raw as { room: string; message: MessageReceivePayload };
        io.to(data.room).emit('message:receive', data.message);
      } catch (err) {
        logger.error('[chat] subscriber parse error', { error: (err as Error).message });
      }
    })
    .catch((err) =>
      logger.error('[chat] Failed to subscribe to chat channel', { error: err.message })
    );
}


// import type { Server, Socket } from 'socket.io';
// import { prisma } from '../../config/database';
// import { redisService } from '../../config/redis';
// import { logger } from '../../utils/logger';

// // ─── Channels ─────────────────────────────────────────────────────────────────
// const CHANNEL_CHAT = 'channel:chat:message';

// // ─── Payload Types ─────────────────────────────────────────────────────────────

// interface MessageSendPayload {
//   taskId: string;
//   content: string;
// }

// interface MessageReceivePayload {
//   id: string;
//   taskId: string;
//   content: string;
//   senderId: string;
//   senderName: string;
//   createdAt: string;
// }

// // ─── Register Handler ─────────────────────────────────────────────────────────

// export function registerChatHandler(io: Server, socket: Socket): void {
//   /**
//    * message:send
//    * Client sends { taskId, content }
//    * → save to DB → Redis PUBLISH → room receives 'message:receive'
//    */
//   socket.on(
//     'message:send',
//     async (payload: MessageSendPayload): Promise<void> => {
//       try {
//         const { taskId, content } = payload;

//         // ── Basic validation ────────────────────────────────────────────────
//         if (!taskId || typeof taskId !== 'string') {
//           socket.emit('error', { event: 'message:send', message: 'taskId is required' });
//           return;
//         }
//         if (!content || typeof content !== 'string' || content.trim().length === 0) {
//           socket.emit('error', { event: 'message:send', message: 'content cannot be empty' });
//           return;
//         }

//         // ── Verify task exists (lightweight — id only) ──────────────────────
//         const task = await prisma.task.findUnique({
//           where: { id: taskId },
//           select: { id: true },
//         });

//         if (!task) {
//           socket.emit('error', { event: 'message:send', message: `Task ${taskId} not found` });
//           return;
//         }

//         // ── Persist message to DB ────────────────────────────────────────────
//         const message = await prisma.message.create({
//           data: {
//             taskId,
//             senderId: socket.userId,
//             content: content.trim(),
//           },
//           select: {
//             id: true,
//             taskId: true,
//             senderId: true,
//             content: true,
//             createdAt: true,
//             sender: {
//               select: { name: true },
//             },
//           },
//         });

//         const outbound: MessageReceivePayload = {
//           id: message.id,
//           taskId: message.taskId,
//           content: message.content,
//           senderId: message.senderId,
//           senderName: message.sender.name,
//           createdAt: message.createdAt.toISOString(),
//         };

//         // ── Redis PUBLISH — fan-out to all socket.io nodes ──────────────────
//         // Other nodes subscribed to this channel will emit to their local sockets.
//         await redisService.publish(CHANNEL_CHAT, {
//           room: `task:${taskId}`,
//           message: outbound,
//         });

//         logger.debug('[chat] message:send published', {
//           taskId,
//           messageId: message.id,
//           senderId: socket.userId,
//         });
//       } catch (err) {
//         logger.error('[chat] message:send error', { error: (err as Error).message });
//         socket.emit('error', { event: 'message:send', message: 'Failed to send message' });
//       }
//     }
//   );
// }

// // ─── Redis Subscriber Setup ───────────────────────────────────────────────────

// /**
//  * Subscribe to the chat channel once at the manager level.
//  * Called from socket.manager.ts during server initialisation.
//  * Emits 'message:receive' to the correct task room on every node.
//  */
// export function subscribeChatChannel(io: Server): void {
//   redisService
//     .subscribe(CHANNEL_CHAT, (raw: unknown) => {
//       try {
//         const data = raw as { room: string; message: MessageReceivePayload };
//         io.to(data.room).emit('message:receive', data.message);
//       } catch (err) {
//         logger.error('[chat] subscriber parse error', { error: (err as Error).message });
//       }
//     })
//     .catch((err) =>
//       logger.error('[chat] Failed to subscribe to chat channel', { error: err.message })
//     );
// }
