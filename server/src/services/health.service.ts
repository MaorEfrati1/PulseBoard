import os from 'os';
import { prisma } from '../config/database';
import { redisService } from '../config/redis';
import { firestoreService } from '../config/firebase';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy';

interface PostgresHealth {
  status: ServiceStatus;
  latencyMs: number;
  error?: string;
}

interface RedisHealth {
  status: ServiceStatus;
  latencyMs: number;
  memoryUsedMb: number;
  memoryPeakMb: number;
  connectedClients: number;
  hitRate: string;
  missRate: string;
  error?: string;
}

interface FirebaseHealth {
  status: ServiceStatus;
  error?: string;
}

interface SystemHealth {
  memoryUsedMb: number;
  memoryTotalMb: number;
  cpuLoad1min: number;
  nodeVersion: string;
}

export interface HealthReport {
  status: ServiceStatus;
  uptime: number;
  services: {
    postgres: PostgresHealth;
    redis: RedisHealth;
    firebase: FirebaseHealth;
  };
  system: SystemHealth;
}

// ─── HealthService ────────────────────────────────────────────────────────────

export class HealthService {
  async getHealthReport(): Promise<HealthReport> {
    const [postgres, redis, firebase] = await Promise.all([
      this._checkPostgres(),
      this._checkRedis(),
      this._checkFirebase(),
    ]);

    const system = this._getSystemInfo();

    // Derive overall status: any unhealthy → unhealthy; any degraded → degraded
    const statuses = [postgres.status, redis.status, firebase.status];
    let status: ServiceStatus = 'healthy';
    if (statuses.includes('unhealthy')) status = 'unhealthy';
    else if (statuses.includes('degraded')) status = 'degraded';

    return {
      status,
      uptime: Math.floor(process.uptime()),
      services: { postgres, redis, firebase },
      system,
    };
  }

  // ── Private checks ────────────────────────────────────────────────────────

  private async _checkPostgres(): Promise<PostgresHealth> {
    const start = process.hrtime.bigint();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const latencyMs = Number((process.hrtime.bigint() - start) / 1_000_000n);

      return {
        status: latencyMs > 500 ? 'degraded' : 'healthy',
        latencyMs,
      };
    } catch (err) {
      logger.warn('[health] PostgreSQL check failed', { error: (err as Error).message });
      return {
        status: 'unhealthy',
        latencyMs: -1,
        error: (err as Error).message,
      };
    }
  }

  private async _checkRedis(): Promise<RedisHealth> {
    const start = process.hrtime.bigint();
    try {
      const pong = await redisService.ping();
      const latencyMs = Number((process.hrtime.bigint() - start) / 1_000_000n);

      if (pong !== 'PONG') throw new Error('Unexpected PING response');

      const info = await redisService.getRedisInfo();

      return {
        status: latencyMs > 100 ? 'degraded' : 'healthy',
        latencyMs,
        ...info,
      };
    } catch (err) {
      logger.warn('[health] Redis check failed', { error: (err as Error).message });
      return {
        status: 'unhealthy',
        latencyMs: -1,
        memoryUsedMb: 0,
        memoryPeakMb: 0,
        connectedClients: 0,
        hitRate: '0%',
        missRate: '0%',
        error: (err as Error).message,
      };
    }
  }

  private async _checkFirebase(): Promise<FirebaseHealth> {
    try {
      await firestoreService.healthCheck();
      return { status: 'healthy' };
    } catch (err) {
      logger.warn('[health] Firebase check failed', { error: (err as Error).message });
      return {
        status: 'unhealthy',
        error: (err as Error).message,
      };
    }
  }

  private _getSystemInfo(): SystemHealth {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const [load1] = os.loadavg();

    return {
      memoryUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      memoryTotalMb: Math.round(totalMem / 1024 / 1024),
      cpuLoad1min: Math.round(load1 * 100) / 100,
      nodeVersion: process.version,
    };
  }
}

export const healthService = new HealthService();
