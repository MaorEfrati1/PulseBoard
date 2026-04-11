import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const SESSION_PREFIX = "session:";
const ONLINE_PREFIX = "online:";

function createClient(name: string): Redis {
  const client = new Redis(REDIS_URL, {
    lazyConnect: true,
    retryStrategy(times) {
      // Exponential backoff: 100ms, 200ms, 400ms … capped at 30s
      const delay = Math.min(100 * 2 ** (times - 1), 30_000);
      console.warn(`[Redis:${name}] Reconnect attempt #${times} in ${delay}ms`);
      return delay;
    },
  });

  client.on("connect", () => console.info(`[Redis:${name}] Connected`));
  client.on("ready", () => console.info(`[Redis:${name}] Ready`));
  // client.on("close", () => console.info(`[Redis:${name}] Connection closed`));
  client.on("error", (err: Error) =>
    console.error(`[Redis:${name}] Error:`, err.message)
  );

  return client;
}

export class RedisService {
  private main: Redis;
  private publisher: Redis;
  private subscriber: Redis;

  constructor() {
    this.main = createClient("main");
    this.publisher = createClient("publisher");
    this.subscriber = createClient("subscriber");
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    await Promise.all([
      this.main.connect(),
      this.publisher.connect(),
      this.subscriber.connect(),
    ]);
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.main.quit(),
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }

  // ── Generic KV ────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.main.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await this.main.set(key, serialized, "EX", ttlSeconds);
    } else {
      await this.main.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.main.del(key);
  }

  /**
   * Deletes all keys matching `pattern` using SCAN (non-blocking, production-safe).
   * Never uses KEYS which blocks the event loop on large keyspaces.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.main.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.main.del(...keys);
      }
    } while (cursor !== "0");
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async setSession(userId: string, data: object, ttl = 86_400): Promise<void> {
    await this.set(`${SESSION_PREFIX}${userId}`, data, ttl);
  }

  async getSession<T>(userId: string): Promise<T | null> {
    return this.get<T>(`${SESSION_PREFIX}${userId}`);
  }

  async deleteSession(userId: string): Promise<void> {
    await this.del(`${SESSION_PREFIX}${userId}`);
  }
  // ── Rate Limiting ──────────────────────────────────────────────────────────

  /**
   * Increments a sliding counter for `key` within `windowSeconds`.
   * Returns the new count after increment.
   */
  async incrementRateLimit(
    key: string,
    windowSeconds: number
  ): Promise<number> {
    const pipeline = this.main.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds);
    const results = await pipeline.exec();
    // results[0] = [error, incrResult]
    const count = (results?.[0]?.[1] as number) ?? 0;
    return count;
  }

  // ── Pub / Sub ──────────────────────────────────────────────────────────────

  async publish(channel: string, message: unknown): Promise<void> {
    const payload =
      typeof message === "string" ? message : JSON.stringify(message);
    await this.publisher.publish(channel, payload);
  }

  async subscribe(
    channel: string,
    callback: (msg: unknown) => void
  ): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on("message", (ch: string, raw: string) => {
      if (ch !== channel) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      callback(parsed);
    });
  }

  // ── Queue (simple FIFO via Redis lists) ───────────────────────────────────

  async enqueue(queue: string, item: unknown): Promise<void> {
    const payload =
      typeof item === "string" ? item : JSON.stringify(item);
    await this.main.rpush(queue, payload);
  }

  async dequeue<T>(queue: string): Promise<T | null> {
    const raw = await this.main.lpop(queue);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  // ── Online Presence ────────────────────────────────────────────────────────

  async setOnline(userId: string, ttl: number = 30): Promise<void> {
    await this.main.set(`${ONLINE_PREFIX}${userId}`, "1", "EX", ttl);
  }

  async deleteOnline(userId: string): Promise<void> {
    await this.del(`${ONLINE_PREFIX}${userId}`);
  }

  /**
   * Returns the subset of `userIds` that currently have an online presence key.
   */
  async getOnlineUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const keys = userIds.map((id) => `${ONLINE_PREFIX}${id}`);
    const values = await this.main.mget(...keys);
    return userIds.filter((_, i) => values[i] !== null);
  }

  // ── Expose raw clients (e.g. for Socket.io adapter) ───────────────────────

  getPublisher(): Redis {
    return this.publisher;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }
}

export const redisService = new RedisService();
