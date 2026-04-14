import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { redisService } from '../config/redis';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const insightSchema = z.object({
  body: z.object({
    taskId: z.string().uuid(),
    context: z.string().max(4000).optional(),
  }),
});

const suggestSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

router.use(authenticate);

/**
 * POST /ai/insight
 * Triggers an AI insight analysis for a task.
 * Publishes to Redis channel → socket.manager picks it up → emits 'ai:new_insight'.
 */
router.post(
  '/insight',
  validate(insightSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { taskId, context } = req.body as { taskId: string; context?: string };

    // Publish to the Redis channel that socket.manager subscribes to
    await redisService.publish('channel:ai:insight', {
      taskId,
      context,
      requestedBy: req.user!.userId,
      insight: 'AI analysis queued — results will arrive via WebSocket',
      severity: 'info',
      timestamp: new Date().toISOString(),
    });

    res.status(202).json({
      status: 'accepted',
      message: 'AI insight request queued. Listen for ai:new_insight over WebSocket.',
    });
  })
);

/**
 * POST /ai/suggest
 * Returns priority/tag suggestions for a task (synchronous stub).
 * Replace the body with a real LLM call when ready.
 */
router.post(
  '/suggest',
  validate(suggestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, description } = req.body as { title: string; description?: string };

    // ── Stub response ─────────────────────────────────────────────────────────
    // Replace this block with your LLM / AI service call.
    const suggestion = {
      priority: 'MEDIUM',
      tags: [] as string[],
      summary: `Auto-generated summary for: ${title}`,
      _note: 'Stub — wire up your AI service here',
    };

    // Naive keyword heuristics so the stub returns something useful in dev
    const text = `${title} ${description ?? ''}`.toLowerCase();
    if (/urgent|blocker|critical|asap/.test(text)) suggestion.priority = 'URGENT';
    else if (/bug|fix|crash|error/.test(text)) suggestion.priority = 'HIGH';
    else if (/chore|refactor|cleanup/.test(text)) suggestion.priority = 'LOW';

    if (/bug|error|crash/.test(text)) suggestion.tags.push('bug');
    if (/ui|design|style/.test(text)) suggestion.tags.push('ui');
    if (/api|backend|db/.test(text)) suggestion.tags.push('backend');
    if (/test|spec|coverage/.test(text)) suggestion.tags.push('testing');

    res.json({ data: suggestion });
  })
);

export default router;
