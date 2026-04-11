import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { taskService, TaskFilters, Pagination } from '../services/task.service';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const TaskStatus = z.enum(['TODO', 'DOING', 'DONE']);
const TaskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    priority: TaskPriority.optional(),
    assigneeId: z.string().uuid().optional(),
    dueDate: z.coerce.date().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),
});

const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: TaskStatus.optional(),
    priority: TaskPriority.optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),
});

const listTasksQuerySchema = z.object({
  query: z.object({
    status: TaskStatus.optional(),
    priority: TaskPriority.optional(),
    assigneeId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

const paginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

const addMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a guaranteed string from req.params.
 * Express params are always plain strings (never arrays), but the
 * @types/express definition widens them to string | string[].
 * Casting here is safe and keeps the rest of the code clean.
 */
function param(req: Request, key: string): string {
  return req.params[key] as string;
}

/**
 * Returns the authenticated user's ID.
 * `authenticate` middleware always populates req.user before any route
 * handler runs, so a non-null assertion is safe here.  Centralising it
 * means a single throw if something ever goes wrong instead of silent
 * undefined propagation.
 */
function userId(req: Request): string {
  if (!req.user?.userId) {
    throw new Error('Unauthenticated request reached a protected route');
  }
  return req.user.userId;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// All routes require authentication
router.use(authenticate);

// GET /tasks
router.get(
  '/',
  validate(listTasksQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, priority, assigneeId, authorId, page, limit } = req.query as any;

    const filters: TaskFilters = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigneeId && { assigneeId }),
      ...(authorId && { authorId }),
    };

    const pagination: Pagination = {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    };

    const result = await taskService.getTasks(filters, pagination);
    res.json(result);
  })
);

// POST /tasks
router.post(
  '/',
  validate(createTaskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.createTask(req.body, userId(req));
    res.status(201).json({ data: task });
  })
);

// GET /tasks/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.getTaskById(param(req, 'id'));
    res.json({ data: task });
  })
);

// PATCH /tasks/:id
router.patch(
  '/:id',
  validate(updateTaskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.updateTask(
      param(req, 'id'),
      req.body,
      userId(req)
    );
    res.json({ data: task });
  })
);

// DELETE /tasks/:id
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await taskService.deleteTask(param(req, 'id'), userId(req));
    res.status(204).send();
  })
);

// GET /tasks/:id/messages
router.get(
  '/:id/messages',
  validate(paginationQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const pagination: Pagination = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    };

    const result = await taskService.getMessages(param(req, 'id'), pagination);
    res.json(result);
  })
);

// POST /tasks/:id/messages
router.post(
  '/:id/messages',
  validate(addMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await taskService.addMessage(
      param(req, 'id'),
      userId(req),
      req.body.content
    );
    res.status(201).json({ data: message });
  })
);

export default router;