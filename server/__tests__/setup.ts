import { prisma } from "../src/config/database";
import { redisService } from "../src/config/redis";

async function cleanDb() {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
}

beforeAll(async () => {
    await redisService.connect();
});

beforeEach(async () => {
    await cleanDb();
});

afterEach(async () => {
    await cleanDb();
});

afterAll(async () => {
    await prisma.$disconnect();
    await redisService.disconnect();
});