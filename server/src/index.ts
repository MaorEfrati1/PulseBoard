import 'dotenv/config';
import { createServer } from 'http';
import { app } from './app';
import { prisma } from './config/database';
import { redisService } from './config/redis';
import { initSocketServer } from './sockets/socket.manager';
import { logger } from './utils/logger';

const PORT = process.env.PORT ?? 4000;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Redis — must be ready before Socket.io attaches its adapter
  await redisService.connect();
  logger.info('[bootstrap] Redis connected');

  // 2. Postgres — connect + warm up the connection pool so the first
  //    real query (including /health) doesn't pay the TCP handshake cost.
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  logger.info('[bootstrap] Postgres connected');

  // 3. HTTP server (wraps Express so Socket.io can share the same port)
  const server = createServer(app);

  // 4. Socket.io — attaches to the HTTP server and registers the Redis adapter
  initSocketServer(server);

  // 5. Listen
  server.listen(PORT, () => {
    logger.info(`[bootstrap] Server listening on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[shutdown] ${signal} received — closing connections`);
    try {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
      logger.info('[shutdown] HTTP server closed');

      await prisma.$disconnect();
      logger.info('[shutdown] Prisma disconnected');

      await redisService.disconnect();
      logger.info('[shutdown] Redis disconnected');

      logger.info('[shutdown] Clean exit');
      process.exit(0);
    } catch (err) {
      logger.error('[shutdown] Error during shutdown', { error: (err as Error).message });
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

// ─── Run ──────────────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  logger.error('[bootstrap] Fatal error — server did not start', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  process.exit(1);
});
