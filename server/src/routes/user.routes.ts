import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const updateUserSchema = z.object({
  body: z.object({
    name:      z.string().min(2).max(50).optional(),
    avatarUrl: z.string().url().optional(),
    fcmToken:  z.string().optional(),
  }),
});

const listUsersQuerySchema = z.object({
  query: z.object({
    page:  z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const userSelect = {
  id:        true,
  email:     true,
  name:      true,
  avatarUrl: true,
  role:      true,
  isActive:  true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Express widens req.params values to string | string[].
 * Inside a route handler the value is always a plain string — this cast is safe.
 */
function param(req: Request, key: string): string {
  return req.params[key] as string;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.use(authenticate);

// GET /users — ADMIN only
router.get(
  '/',
  authorize('ADMIN'),
  validate(listUsersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({ select: userSelect, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count(),
    ]);

    res.json({
      data: users,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  })
);

// GET /users/me — current user profile
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where:  { id: req.user!.userId },
      select: userSelect,
    });

    if (!user) throw new NotFoundError('User not found');
    res.json({ data: user });
  })
);

// GET /users/:id — own profile or ADMIN
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = param(req, 'id');

    if (id !== req.user!.userId && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Access denied');
    }

    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundError('User not found');

    res.json({ data: user });
  })
);

// PATCH /users/:id — own profile or ADMIN
router.patch(
  '/:id',
  validate(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = param(req, 'id');

    if (id !== req.user!.userId && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Access denied');
    }

    const user = await prisma.user.update({
      where:  { id },
      data:   req.body,
      select: userSelect,
    });

    res.json({ data: user });
  })
);

// DELETE /users/:id — ADMIN only (soft-delete via isActive)
router.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = param(req, 'id');

    await prisma.user.update({
      where: { id },
      data:  { isActive: false },
    });

    res.status(204).send();
  })
);

export default router;
