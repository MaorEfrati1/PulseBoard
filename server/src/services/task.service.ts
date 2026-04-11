import { Task, Message, Prisma, TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '../config/database';
import { redisService } from '../config/redis';
import { firestoreService } from '../config/firebase';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  authorId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: Date;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: Date;
  tags?: string[];
}

// ─── Cache Key Helpers ────────────────────────────────────────────────────────

// Bump this version whenever the shape of cached task data changes.
// Old keys with a different version will simply be cache misses and
// will be overwritten with fresh data — no manual Redis flush needed.
const CACHE_VERSION = 'v2';

const TASKS_LIST_PATTERN = 'cache:tasks:list:*';
const tasksListKey = (filters: TaskFilters, pagination: Pagination) =>
  `cache:tasks:list:${CACHE_VERSION}:${JSON.stringify({ filters, pagination })}`;
const taskDetailKey = (id: string) => `cache:tasks:detail:${CACHE_VERSION}:${id}`;

// ─── TaskService ──────────────────────────────────────────────────────────────

export class TaskService {
  // ── createTask ──────────────────────────────────────────────────────────────

  async createTask(data: CreateTaskInput, authorId: string): Promise<Task> {
    // 1. Save to DB
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority ?? 'MEDIUM',
        assigneeId: data.assigneeId,
        dueDate: data.dueDate,
        tags: data.tags ?? [],
        authorId,
        status: 'TODO',
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        authorId: true,
        assigneeId: true,
        dueDate: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 2. Write ActivityLog to DB
    await prisma.activityLog.create({
      data: {
        userId: authorId,
        action: 'task.created',
        entityId: task.id,
        entityType: 'task',
        metadata: { taskTitle: task.title },
      },
    });

    // 3. Write to Firestore activity_feed
    await this._writeFirestoreActivity({
      userId: authorId,
      action: 'task.created',
      taskId: task.id,
      taskTitle: task.title,
      metadata: {},
    }).catch((err) =>
      logger.warn('Firestore write failed (createTask)', { error: err.message })
    );

    // 4. Invalidate Redis cache for task lists
    await redisService.invalidatePattern(TASKS_LIST_PATTERN);

    logger.info('Task created', { taskId: task.id, authorId });
    return task as Task;
  }

  // ── getTasks ────────────────────────────────────────────────────────────────

  async getTasks(
    filters: TaskFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<Task>> {
    const cacheKey = tasksListKey(filters, pagination);

    // Cache-aside: try Redis first (TTL 5 min)
    const cached = await redisService.get<PaginatedResult<Task>>(cacheKey);
    if (cached) return cached;

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters.authorId && { authorId: filters.authorId }),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          authorId: true,
          assigneeId: true,
          dueDate: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.task.count({ where }),
    ]);

    const result: PaginatedResult<Task> = {
      data: tasks as Task[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Store in Redis with 5 min TTL
    await redisService.set(cacheKey, result, 300);

    return result;
  }

  // ── getTaskById ─────────────────────────────────────────────────────────────

  async getTaskById(id: string): Promise<Task & { messages: Message[] }> {
    const cacheKey = taskDetailKey(id);

    // Cache-aside: try Redis first (TTL 2 min)
    const cached = await redisService.get<Task & { messages: Message[] }>(cacheKey);
    if (cached) return cached;

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        authorId: true,
        assigneeId: true,
        dueDate: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            taskId: true,
            senderId: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!task) throw new NotFoundError(`Task ${id} not found`);

    await redisService.set(cacheKey, task, 120);

    return task as Task & { messages: Message[] };
  }

  // ── updateTask ──────────────────────────────────────────────────────────────

  async updateTask(
    id: string,
    data: UpdateTaskInput,
    userId: string
  ): Promise<Task> {
    // Fetch current task to detect status change
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, status: true, title: true, authorId: true },
    });

    if (!existing) throw new NotFoundError(`Task ${id} not found`);

    const statusChanged = data.status !== undefined && data.status !== existing.status;

    // Update in DB
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        authorId: true,
        assigneeId: true,
        dueDate: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If status changed → ActivityLog + Firestore + Redis PUBLISH
    if (statusChanged) {
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'task.status_changed',
          entityId: id,
          entityType: 'task',
          metadata: {
            taskTitle: task.title,
            from: existing.status,
            to: data.status,
          },
        },
      });

      await this._writeFirestoreActivity({
        userId,
        action: 'task.updated',
        taskId: task.id,
        taskTitle: task.title,
        metadata: { from: existing.status, to: data.status },
      }).catch((err) =>
        logger.warn('Firestore write failed (updateTask)', { error: err.message })
      );

      // Redis Pub/Sub — notify all Socket.io subscribers
      await redisService.publish('channel:task:updated', {
        taskId: task.id,
        changes: { status: data.status },
        updatedBy: userId,
      });
    }

    // Invalidate caches
    await Promise.all([
      redisService.invalidatePattern(TASKS_LIST_PATTERN),
      redisService.del(taskDetailKey(id)),
    ]);

    logger.info('Task updated', { taskId: id, userId, statusChanged });
    return task as Task;
  }

  // ── deleteTask ──────────────────────────────────────────────────────────────

  async deleteTask(id: string, userId: string): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!task) throw new NotFoundError(`Task ${id} not found`);

    if (task.authorId !== userId) {
      throw new ForbiddenError('Only the task author can delete this task');
    }

    await prisma.task.delete({ where: { id } });

    // Invalidate caches
    await Promise.all([
      redisService.invalidatePattern(TASKS_LIST_PATTERN),
      redisService.del(taskDetailKey(id)),
    ]);

    logger.info('Task deleted', { taskId: id, userId });
  }

  // ── getMessages ─────────────────────────────────────────────────────────────

  async getMessages(
    taskId: string,
    pagination: Pagination
  ): Promise<PaginatedResult<Message>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { taskId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          taskId: true,
          senderId: true,
          content: true,
          createdAt: true,
        },
      }),
      prisma.message.count({ where: { taskId } }),
    ]);

    return {
      data: messages as Message[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── addMessage ──────────────────────────────────────────────────────────────

  async addMessage(
    taskId: string,
    senderId: string,
    content: string
  ): Promise<Message> {
    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    const message = await prisma.message.create({
      data: { taskId, senderId, content },
      select: {
        id: true,
        taskId: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });

    // Invalidate task detail cache (messages are included)
    await redisService.del(taskDetailKey(taskId));

    return message as Message;
  }

  // ── Private Helpers ──────────────────────────────────────────────────────────

  private async _writeFirestoreActivity(params: {
    userId: string;
    action: string;
    taskId: string;
    taskTitle: string;
    metadata: Record<string, unknown>;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { name: true },
    });

    await firestoreService.addActivity({
      userId: params.userId,
      userName: user?.name ?? 'Unknown',
      action: params.action,
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      metadata: params.metadata,
    });
  }
}

export const taskService = new TaskService();
