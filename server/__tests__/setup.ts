import { prisma } from "../src/config/database";
import { redisService } from "../src/config/redis";

// ─── Global test lifecycle ────────────────────────────────────────────────────
//
// Runs via setupFilesAfterEnv for every test suite.
//
// Strategy:
//   • beforeAll — ensure Redis is connected (idempotent).
//   • afterAll  — wipe the entire DB + flush Redis once the suite finishes.
//
// Individual test files are responsible for seeding their own data.
// We intentionally do NOT wipe between individual tests here because suites
// such as tasks.test.ts create users + tokens in a describe-level beforeAll
// and must keep them alive for all tests inside that describe block.

beforeAll(async () => {
    await redisService.connect(); // idempotent
});

afterAll(async () => {
    // Teardown in FK-safe order
    await prisma.message.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.task.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    // Flush Redis so stale cache never leaks between test suites
    await redisService.flushAll();

    await prisma.$disconnect();
    await redisService.disconnect(); // idempotent
});
