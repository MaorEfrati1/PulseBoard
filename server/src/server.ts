import dotenv from 'dotenv';
import { app } from './app';
import { prisma } from './config/database';
import { redisService } from './config/redis';
import { logger } from './utils/logger';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await redisService.connect();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});