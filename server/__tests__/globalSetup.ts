import { redisService } from "../src/config/redis";

export default async function globalSetup() {
    await redisService.connect();
}