import { createServer } from 'http';
import dotenv from 'dotenv';
import { app } from './app';
import { prisma } from './config/database';
import { redisService } from './config/redis';
import { initSocketServer } from './sockets/socket.manager';
import { logger } from './utils/logger';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // ── 1. Connect Redis (must be ready before Socket.io adapter) ─────────────
  await redisService.connect();
  logger.info('Redis connected');

  // ── 2. Wrap Express in an HTTP server ─────────────────────────────────────
  // Socket.io needs the raw http.Server, not the Express app directly.
  const httpServer = createServer(app);

  // ── 3. Attach Socket.io ───────────────────────────────────────────────────
  initSocketServer(httpServer);

  // ── 4. Start listening ────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', err);
  process.exit(1);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`[server] ${signal} received — shutting down gracefully`);
  try {
    await prisma.$disconnect();
    await redisService.disconnect();
    logger.info('[server] Clean shutdown complete');
  } catch (err) {
    logger.error('[server] Error during shutdown', err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
