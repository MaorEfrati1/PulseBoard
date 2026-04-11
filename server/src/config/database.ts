import { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────
// Singleton PrismaClient
// ─────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === 'development'
                ? ['query', 'warn', 'error']
                : ['warn', 'error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// ─────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────

async function disconnect(signal: string): Promise<void> {
    console.log(`[db] Received ${signal} — disconnecting Prisma client...`);
    await prisma.$disconnect();
    console.log('[db] Prisma client disconnected. Exiting.');
    process.exit(0);
}

process.on('SIGINT', () => disconnect('SIGINT'));
process.on('SIGTERM', () => disconnect('SIGTERM'));

export default prisma;
