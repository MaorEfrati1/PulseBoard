import { Request, Response, NextFunction } from 'express';
import { redisService } from '../config/redis';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestMetric {
  method: string;
  path: string;       // normalized: /tasks/123 → /tasks/:id
  statusCode: number;
  durationMs: number;
  cacheHit: boolean;
  userId?: string;
  timestamp: string;
}

interface RouteStats {
  path: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  cacheHitRate: string;
  errorRate: string;
}

export interface MetricsSummary {
  routes: RouteStats[];
  overall: {
    totalRequests: number;
    avgResponseMs: number;
    cacheHitRate: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METRICS_KEY = 'metrics:requests';
const MAX_ENTRIES = 10_000;
const WINDOW_SIZE = 100;        // percentile window per route
const ENTRY_TTL_SEC = 86_400;   // 24 hours

// ─── Path Normalizer ─────────────────────────────────────────────────────────

/**
 * Replaces dynamic segments in a URL path with named placeholders so that
 * /tasks/abc-123-def and /tasks/456-xyz both map to /tasks/:id.
 *
 * Handles:
 *  - UUIDs  (8-4-4-4-12 hex)
 *  - MongoDB ObjectIDs (24 hex chars)
 *  - Pure numeric IDs
 */
function normalizePath(rawPath: string): string {
  return rawPath
    // UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id'
    )
    // MongoDB ObjectID: 24 hex chars
    .replace(/\b[0-9a-f]{24}\b/gi, ':id')
    // Pure numeric IDs
    .replace(/\b\d+\b/g, ':id')
    // Strip query string (just in case it leaked in)
    .split('?')[0];
}

// ─── Percentile Calculator ───────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Records per-request metrics to Redis (circular buffer, max 10 000 entries).
 * Also sets the X-Response-Time response header.
 *
 * Attaches `req.cacheHit = true` upstream (in task.service) to flag cache hits.
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    // ── Duration ────────────────────────────────────────────────────────────
    const endNs = process.hrtime.bigint();
    const durationMs = Number((endNs - startNs) / 1_000_000n);

    // ── X-Response-Time header ───────────────────────────────────────────────
    // Note: header is set after finish — use res.setHeader before finish instead.
    // We write it pre-finish via a one-time 'header' hook below; this block
    // handles the async Redis write only.

    const metric: RequestMetric = {
      method: req.method,
      path: normalizePath(req.path),
      statusCode: res.statusCode,
      durationMs,
      cacheHit: (req as any).cacheHit === true,
      userId: req.user?.userId,
      timestamp: new Date().toISOString(),
    };

    // Fire-and-forget — never block the response
    _persistMetric(metric).catch((err) =>
      logger.warn('[metrics] Failed to persist metric', { error: (err as Error).message })
    );
  });

  // Set X-Response-Time BEFORE headers are sent
  const startNsHeader = process.hrtime.bigint();
  const originalWriteHead = res.writeHead.bind(res);

  // @ts-expect-error — overriding overloaded writeHead
  res.writeHead = function (...args: Parameters<typeof res.writeHead>) {
    const ms = Number((process.hrtime.bigint() - startNsHeader) / 1_000_000n);
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${ms}ms`);
    }
    return originalWriteHead(...args);
  };

  next();
}

// ─── Redis Persistence ────────────────────────────────────────────────────────

async function _persistMetric(metric: RequestMetric): Promise<void> {
  const payload = JSON.stringify(metric);

  // MULTI/EXEC: atomic push + trim + expire
  // RedisService exposes the raw main client only indirectly; we call the
  // public helpers instead and accept two round-trips (still non-blocking).
  await redisService.lpushMetric(METRICS_KEY, payload, MAX_ENTRIES, ENTRY_TTL_SEC);
}

// ─── Summary Calculator ───────────────────────────────────────────────────────

/**
 * Reads up to MAX_ENTRIES metrics from Redis and computes per-route and
 * overall statistics.
 *
 * Called by GET /metrics/summary — protected, ADMIN only.
 */
export async function getMetricsSummary(): Promise<MetricsSummary> {
  const raw = await redisService.lrangeMetrics(METRICS_KEY, 0, MAX_ENTRIES - 1);

  const metrics: RequestMetric[] = raw
    .map((s) => {
      try {
        return JSON.parse(s) as RequestMetric;
      } catch {
        return null;
      }
    })
    .filter((m): m is RequestMetric => m !== null);

  if (metrics.length === 0) {
    return {
      routes: [],
      overall: { totalRequests: 0, avgResponseMs: 0, cacheHitRate: '0%' },
    };
  }

  // ── Group by "METHOD /path" ──────────────────────────────────────────────
  const groups = new Map<string, RequestMetric[]>();

  for (const m of metrics) {
    const key = `${m.method} ${m.path}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(m);
    groups.set(key, bucket);
  }

  // ── Per-route stats ──────────────────────────────────────────────────────
  const routes: RouteStats[] = [];

  for (const [routeKey, entries] of groups) {
    // Use only the most recent WINDOW_SIZE entries for percentiles
    const window = entries.slice(0, WINDOW_SIZE);
    const durations = window.map((e) => e.durationMs).sort((a, b) => a - b);

    const cacheHits = window.filter((e) => e.cacheHit).length;
    const errors = window.filter((e) => e.statusCode >= 400).length;

    routes.push({
      path: routeKey,
      count: entries.length,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      p99Ms: percentile(durations, 99),
      cacheHitRate: `${Math.round((cacheHits / window.length) * 100)}%`,
      errorRate: `${((errors / window.length) * 100).toFixed(1)}%`,
    });
  }

  // Sort by request count descending
  routes.sort((a, b) => b.count - a.count);

  // ── Overall stats ────────────────────────────────────────────────────────
  const totalRequests = metrics.length;
  const avgResponseMs = Math.round(
    metrics.reduce((sum, m) => sum + m.durationMs, 0) / totalRequests
  );
  const overallCacheHits = metrics.filter((m) => m.cacheHit).length;

  return {
    routes,
    overall: {
      totalRequests,
      avgResponseMs,
      cacheHitRate: `${Math.round((overallCacheHits / totalRequests) * 100)}%`,
    },
  };
}
