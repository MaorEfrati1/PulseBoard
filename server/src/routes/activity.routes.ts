import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const listActivitySchema = z.object({
  query: z.object({
    userId:     z.string().uuid().optional(),
    entityId:   z.string().uuid().optional(),
    entityType: z.string().optional(),
    page:       z.coerce.number().int().min(1).optional().default(1),
    limit:      z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Express widens req.query values to string | string[] | ParsedQs.
 * After zod validation the value is always a plain string — this cast is safe.
 */
function query(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Express widens req.params values to string | string[].
 * Inside a route handler the value is always a plain string — this cast is safe.
 */
function param(req: Request, key: string): string {
  return req.params[key] as string;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.use(authenticate);

// GET /activity — own activity (or any userId for ADMIN)
router.get(
  '/',
  validate(listActivitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const page       = Number(query(req, 'page'))  || 1;
    const limit      = Number(query(req, 'limit')) || 20;
    const skip       = (page - 1) * limit;
    const isAdmin    = req.user!.role === 'ADMIN';

    // Non-admins can only see their own activity
    const userId     = isAdmin && query(req, 'userId')
      ? query(req, 'userId')!
      : req.user!.userId;

    const entityId   = query(req, 'entityId');
    const entityType = query(req, 'entityType');

    const where = {
      userId,
      ...(entityId   && { entityId }),
      ...(entityType && { entityType }),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  })
);

// GET /activity/entity/:type/:id — all activity for a specific entity
router.get(
  '/entity/:type/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const type = param(req, 'type');
    const id   = param(req, 'id');

    const where = {
      entityType: type,
      entityId:   id,
      // Non-admins see only their own actions on that entity
      ...(req.user!.role !== 'ADMIN' && { userId: req.user!.userId }),
    };

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.json({ data: logs });
  })
);

// GET /activity/admin/all — full feed, ADMIN only
router.get(
  '/admin/all',
  authorize('ADMIN'),
  validate(listActivitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const page  = Number(query(req, 'page'))  || 1;
    const limit = Number(query(req, 'limit')) || 20;
    const skip  = (page - 1) * limit;

    const [logs, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.activityLog.count(),
    ]);

    res.json({
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  })
);

export default router;
