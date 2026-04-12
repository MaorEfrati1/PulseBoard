import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getMetricsSummary } from '../middleware/metrics.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /metrics/summary
 * Protected — ADMIN only.
 *
 * Returns per-route p50/p95/p99 latency, cache-hit rate, error rate,
 * and overall aggregate stats derived from the Redis circular buffer.
 */
router.get(
  '/summary',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await getMetricsSummary();
    res.json(summary);
  })
);

export default router;
