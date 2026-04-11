import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { redisService } from '../src/config/redis';
import bcrypt from 'bcryptjs';

// ─── Test Setup ───────────────────────────────────────────────────────────────

let authorToken: string;
let otherToken: string;
let authorId: string;
let otherId: string;

const API = '/api/v1';

beforeAll(async () => {
  // Redis lifecycle is managed by setup.ts (setupFilesAfterEnv).
  // We only seed users and obtain tokens here.

  // Clean slate
  await prisma.message.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('Password123!', 12);

  const author = await prisma.user.create({
    data: { email: 'author@test.com', passwordHash: hash, name: 'Author User' },
  });
  const other = await prisma.user.create({
    data: { email: 'other@test.com', passwordHash: hash, name: 'Other User' },
  });

  authorId = author.id;
  otherId = other.id;

  const authorLogin = await request(app)
    .post(`${API}/auth/login`)
    .send({ email: 'author@test.com', password: 'Password123!' });

  const otherLogin = await request(app)
    .post(`${API}/auth/login`)
    .send({ email: 'other@test.com', password: 'Password123!' });

  authorToken = authorLogin.body.data.accessToken;
  otherToken = otherLogin.body.data.accessToken;
});

// Helper — clears tasks from DB and invalidates only task-related cache keys.
// Deliberately does NOT touch session:* keys so auth tokens remain valid
// for the duration of the suite.
const clearTasks = async () => {
  await prisma.message.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await redisService.invalidatePattern('cache:tasks:*');
};

// ─── CRUD Happy Paths ─────────────────────────────────────────────────────────

describe('POST /tasks — create task', () => {
  afterEach(clearTasks);

  it('creates a task and returns 201', async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Build auth service',
        description: 'JWT + Redis sessions',
        priority: 'HIGH',
        tags: ['backend', 'auth'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Build auth service',
      priority: 'HIGH',
      status: 'TODO',
      authorId,
    });
    expect(res.body.data.id).toBeDefined();
  });

  it('creates a task with minimal required fields', async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Minimal task' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('TODO');
    expect(res.body.data.priority).toBe('MEDIUM');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ description: 'No title here' });

    expect(res.status).toBe(400);
  });
});

describe('GET /tasks — list tasks', () => {
  let taskId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Seeded task', priority: 'LOW' });
    taskId = res.body.data.id;
  });

  afterAll(clearTasks);

  it('returns paginated task list', async () => {
    const res = await request(app)
      .get(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(typeof res.body.meta.total).toBe('number');
  });

  it('GET /tasks/:id returns task with messages array', async () => {
    const res = await request(app)
      .get(`${API}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(taskId);
    expect(Array.isArray(res.body.data.messages)).toBe(true);
  });
});

describe('PATCH /tasks/:id — update task', () => {
  let taskId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Task to update' });
    taskId = res.body.data.id;
  });

  afterEach(clearTasks);

  it('updates task status to DOING', async () => {
    const res = await request(app)
      .patch(`${API}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ status: 'DOING' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DOING');
  });

  it('partially updates only provided fields', async () => {
    const res = await request(app)
      .patch(`${API}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ priority: 'HIGH' });

    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('HIGH');
    expect(res.body.data.title).toBe('Task to update');
  });
});

describe('DELETE /tasks/:id — delete task', () => {
  let taskId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Task to delete' });
    taskId = res.body.data.id;
  });

  afterEach(clearTasks);

  it('author can delete their task', async () => {
    const res = await request(app)
      .delete(`${API}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(204);

    const check = await request(app)
      .get(`${API}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(check.status).toBe(404);
  });
});

// ─── 401 — No Token ───────────────────────────────────────────────────────────

describe('401 — unauthenticated requests', () => {
  it('GET /tasks returns 401 without token', async () => {
    const res = await request(app).get(`${API}/tasks`);
    expect(res.status).toBe(401);
  });

  it('POST /tasks returns 401 without token', async () => {
    const res = await request(app).post(`${API}/tasks`).send({ title: 'Should fail' });
    expect(res.status).toBe(401);
  });

  it('GET /tasks/:id returns 401 without token', async () => {
    const res = await request(app).get(`${API}/tasks/some-id`);
    expect(res.status).toBe(401);
  });

  it('PATCH /tasks/:id returns 401 without token', async () => {
    const res = await request(app).patch(`${API}/tasks/some-id`).send({ status: 'DONE' });
    expect(res.status).toBe(401);
  });

  it('DELETE /tasks/:id returns 401 without token', async () => {
    const res = await request(app).delete(`${API}/tasks/some-id`);
    expect(res.status).toBe(401);
  });
});

// ─── 403 — Forbidden ──────────────────────────────────────────────────────────

describe('403 — non-author cannot delete', () => {
  let taskId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Protected task' });
    taskId = res.body.data.id;
  });

  afterAll(clearTasks);

  it('returns 403 when non-author tries to delete', async () => {
    const res = await request(app)
      .delete(`${API}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('author can still delete after failed attempt', async () => {
    const res = await request(app)
      .delete(`${API}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(204);
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('Pagination — page 2 returns correct data', () => {
  beforeAll(async () => {
    // Clean slate: wipe tasks + task cache only (sessions stay intact)
    await clearTasks();
    const creates = Array.from({ length: 25 }, (_, i) =>
      request(app)
        .post(`${API}/tasks`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: `Pagination task ${i + 1}` })
    );
    await Promise.all(creates);
  });

  afterAll(clearTasks);

  it('page 1 with limit 10 returns 10 items', async () => {
    const res = await request(app)
      .get(`${API}/tasks?page=1&limit=10`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(25);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(3);
  });

  it('page 2 with limit 10 returns correct next batch', async () => {
    const page1 = await request(app)
      .get(`${API}/tasks?page=1&limit=10`)
      .set('Authorization', `Bearer ${authorToken}`);

    const page2 = await request(app)
      .get(`${API}/tasks?page=2&limit=10`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(10);
    expect(page2.body.meta.page).toBe(2);

    const page1Ids = new Set(page1.body.data.map((t: any) => t.id));
    const page2Ids = page2.body.data.map((t: any) => t.id);
    page2Ids.forEach((id: string) => expect(page1Ids.has(id)).toBe(false));
  });

  it('last page returns remaining items', async () => {
    const res = await request(app)
      .get(`${API}/tasks?page=3&limit=10`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta.page).toBe(3);
  });
});

// ─── Filters ──────────────────────────────────────────────────────────────────

describe('Filters — status filter returns only matching tasks', () => {
  beforeAll(async () => {
    // Clean slate: ensures no leftover tasks or task cache from pagination
    await clearTasks();

    await request(app).post(`${API}/tasks`).set('Authorization', `Bearer ${authorToken}`).send({ title: 'Filter TODO 1' });
    await request(app).post(`${API}/tasks`).set('Authorization', `Bearer ${authorToken}`).send({ title: 'Filter TODO 2' });
    await request(app).post(`${API}/tasks`).set('Authorization', `Bearer ${authorToken}`).send({ title: 'Filter TODO 3' });

    const d1 = await request(app).post(`${API}/tasks`).set('Authorization', `Bearer ${authorToken}`).send({ title: 'Filter DOING 1' });
    await request(app).patch(`${API}/tasks/${d1.body.data.id}`).set('Authorization', `Bearer ${authorToken}`).send({ status: 'DOING' });

    const d2 = await request(app).post(`${API}/tasks`).set('Authorization', `Bearer ${authorToken}`).send({ title: 'Filter DOING 2' });
    await request(app).patch(`${API}/tasks/${d2.body.data.id}`).set('Authorization', `Bearer ${authorToken}`).send({ status: 'DOING' });

    const done1 = await request(app).post(`${API}/tasks`).set('Authorization', `Bearer ${authorToken}`).send({ title: 'Filter DONE 1' });
    await request(app).patch(`${API}/tasks/${done1.body.data.id}`).set('Authorization', `Bearer ${authorToken}`).send({ status: 'DONE' });
  });

  afterAll(clearTasks);

  it('status=TODO returns only TODO tasks', async () => {
    const res = await request(app).get(`${API}/tasks?status=TODO`).set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    res.body.data.forEach((t: any) => expect(t.status).toBe('TODO'));
  });

  it('status=DOING returns only DOING tasks', async () => {
    const res = await request(app).get(`${API}/tasks?status=DOING`).set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    res.body.data.forEach((t: any) => expect(t.status).toBe('DOING'));
  });

  it('status=DONE returns only DONE tasks', async () => {
    const res = await request(app).get(`${API}/tasks?status=DONE`).set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((t: any) => expect(t.status).toBe('DONE'));
  });

  it('filters by priority=HIGH', async () => {
    await request(app).post(`${API}/tasks`).set('Authorization', `Bearer ${authorToken}`).send({ title: 'High priority task', priority: 'HIGH' });
    const res = await request(app).get(`${API}/tasks?priority=HIGH`).set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((t: any) => expect(t.priority).toBe('HIGH'));
  });

  it('filters by authorId', async () => {
    const res = await request(app).get(`${API}/tasks?authorId=${authorId}`).set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((t: any) => expect(t.authorId).toBe(authorId));
  });
});

// ─── Messages ─────────────────────────────────────────────────────────────────

describe('Task messages', () => {
  let taskId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${API}/tasks`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Task with chat' });
    taskId = res.body.data.id;
  });

  afterAll(clearTasks);

  it('POST /tasks/:id/messages adds a message', async () => {
    const res = await request(app)
      .post(`${API}/tasks/${taskId}/messages`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: 'Hello team!' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Hello team!');
    expect(res.body.data.senderId).toBe(authorId);
    expect(res.body.data.taskId).toBe(taskId);
  });

  it('GET /tasks/:id/messages returns paginated messages', async () => {
    const res = await request(app)
      .get(`${API}/tasks/${taskId}/messages`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it('rejects message with empty content', async () => {
    const res = await request(app)
      .post(`${API}/tasks/${taskId}/messages`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
  });

  it('rejects message exceeding 2000 chars', async () => {
    const res = await request(app)
      .post(`${API}/tasks/${taskId}/messages`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
  });
});
