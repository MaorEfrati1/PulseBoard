import { prisma } from "../src/config/database";
import { redisService } from "../src/config/redis";

export default async function globalTeardown() {
    await prisma.$disconnect();
    await redisService.disconnect();
}