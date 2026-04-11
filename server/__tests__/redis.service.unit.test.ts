// ── ioredis mock ──────────────────────────────────────────────────────────────
//
// KEY INSIGHT: redis.ts exports a singleton (`export const redisService = new RedisService()`)
// which runs at import time — before any beforeEach. So jest.mock's factory must
// immediately return a fully working mock (with `.on`, `.connect`, etc.).
//
// We store every created instance on globalThis.__redisMocks__ (the only way to
// share state between the hoisted factory and the outer test scope).

jest.mock("ioredis", () => {
  const build = () => {
    const inst = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
      scan: jest.fn().mockResolvedValue(["0", []]),
      mget: jest.fn().mockResolvedValue([]),
      rpush: jest.fn().mockResolvedValue(1),
      lpop: jest.fn().mockResolvedValue(null),
      publish: jest.fn().mockResolvedValue(1),
      subscribe: jest.fn().mockResolvedValue(undefined),
      pipeline: jest.fn(() => ({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 0], [null, "OK"]]),
      })),
      on: jest.fn(),
    };

    const g = globalThis as unknown as { __redisMocks__: typeof inst[] };
    g.__redisMocks__ = g.__redisMocks__ ?? [];
    g.__redisMocks__.push(inst);
    return inst;
  };

  return jest.fn().mockImplementation(build);
});

// ── Imports (after mock registration) ────────────────────────────────────────
import { RedisService } from "../src/config/redis";
import Redis from "ioredis";

// ── Types ─────────────────────────────────────────────────────────────────────
type MockInstance = {
  connect: jest.Mock; quit: jest.Mock;
  get: jest.Mock; set: jest.Mock; del: jest.Mock;
  scan: jest.Mock; mget: jest.Mock;
  rpush: jest.Mock; lpop: jest.Mock;
  publish: jest.Mock; subscribe: jest.Mock;
  pipeline: jest.Mock;
  on: jest.Mock;
};

function getMocks(): MockInstance[] {
  return ((globalThis as unknown) as { __redisMocks__: MockInstance[] }).__redisMocks__ ?? [];
}

// ── Shared in-memory store ────────────────────────────────────────────────────
const store: Record<string, { value: string; expiresAt?: number }> = {};

function storeGet(key: string): string | null {
  const entry = store[key];
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) { delete store[key]; return null; }
  return entry.value;
}

function wireStore(m: MockInstance) {
  m.get.mockImplementation((...args: unknown[]) =>
    Promise.resolve(storeGet(args[0] as string))
  );
  m.set.mockImplementation((...args: unknown[]) => {
    const [key, value, exFlag, ttl] = args as [string, string, string?, number?];
    store[key] = { value, expiresAt: exFlag === "EX" && ttl ? Date.now() + ttl * 1000 : undefined };
    return Promise.resolve("OK");
  });
  m.del.mockImplementation((...args: unknown[]) => {
    (args as string[]).forEach((k) => delete store[k]);
    return Promise.resolve(args.length);
  });
  m.mget.mockImplementation((...args: unknown[]) =>
    Promise.resolve((args as string[]).map((k) => storeGet(k)))
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("RedisService", () => {
  let service: RedisService;
  let main: MockInstance;
  let publisher: MockInstance;
  let subscriber: MockInstance;
  let messageHandler: ((ch: string, msg: string) => void) | null;

  beforeEach(async () => {
    // Clear store and global mock list
    Object.keys(store).forEach((k) => delete store[k]);
    messageHandler = null;
    const g = globalThis as unknown as { __redisMocks__: MockInstance[] };
    g.__redisMocks__ = [];

    // Reset the Redis constructor mock so the next 3 calls create fresh instances
    (Redis as jest.MockedClass<typeof Redis>).mockClear();

    // Create service — this triggers 3x `new Redis()` inside the constructor
    service = new RedisService();

    // Grab the 3 instances in creation order
    const mocks = getMocks();
    main = mocks[0]!;
    publisher = mocks[1]!;
    subscriber = mocks[2]!;

    // Wire in-memory store to main
    wireStore(main);

    // Capture the subscriber's message listener
    subscriber.on.mockImplementation((event: string, cb: (...a: unknown[]) => void) => {
      if (event === "message") messageHandler = cb as (ch: string, msg: string) => void;
    });

    // Wire pipeline exec to a controllable mock on main
    main.pipeline.mockImplementation(() => ({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 0], [null, "OK"]]),
    }));

    await service.connect();
  });

  // ── connect ───────────────────────────────────────────────────────────────
  describe("connect()", () => {
    it("opens all three connections", () => {
      expect(main.connect).toHaveBeenCalledTimes(1);
      expect(publisher.connect).toHaveBeenCalledTimes(1);
      expect(subscriber.connect).toHaveBeenCalledTimes(1);
    });
  });

  // ── get / set ─────────────────────────────────────────────────────────────
  describe("get / set", () => {
    it("stores and retrieves a JSON object", async () => {
      await service.set("user:1", { name: "Alice" });
      expect(await service.get<{ name: string }>("user:1")).toEqual({ name: "Alice" });
    });

    it("stores a plain string and retrieves it", async () => {
      await service.set("greeting", "hello");
      expect(await service.get<string>("greeting")).toBe("hello");
    });

    it("returns null for a missing key", async () => {
      expect(await service.get("missing")).toBeNull();
    });

    it("calls SET with EX flag when ttlSeconds provided", async () => {
      await service.set("tmp", "value", 60);
      expect(main.set).toHaveBeenCalledWith("tmp", "value", "EX", 60);
    });

    it("calls SET without EX flag when ttlSeconds omitted", async () => {
      await service.set("persistent", "value");
      expect(main.set).toHaveBeenCalledWith("persistent", "value");
    });
  });

  // ── del ───────────────────────────────────────────────────────────────────
  describe("del()", () => {
    it("deletes a key", async () => {
      await service.set("key", "val");
      await service.del("key");
      expect(await service.get("key")).toBeNull();
    });
  });

  // ── invalidatePattern ─────────────────────────────────────────────────────
  describe("invalidatePattern()", () => {
    it("uses SCAN and deletes matching keys", async () => {
      main.scan
        .mockResolvedValueOnce(["42", ["cache:a", "cache:b"]])
        .mockResolvedValueOnce(["0", []]);

      await service.invalidatePattern("cache:*");

      expect(main.scan).toHaveBeenCalledWith("0", "MATCH", "cache:*", "COUNT", 100);
      expect(main.del).toHaveBeenCalledWith("cache:a", "cache:b");
    });

    it("handles empty results without calling del", async () => {
      main.scan.mockResolvedValueOnce(["0", []]);
      await service.invalidatePattern("nothing:*");
      expect(main.del).not.toHaveBeenCalled();
    });
  });

  // ── Sessions ──────────────────────────────────────────────────────────────
  describe("session operations", () => {
    const userId = "user-42";
    const sessionData = { role: "admin", token: "abc" };

    it("sets a session with default TTL (86400s)", async () => {
      await service.setSession(userId, sessionData);
      expect(main.set).toHaveBeenCalledWith(
        `session:${userId}`, JSON.stringify(sessionData), "EX", 86_400
      );
    });

    it("sets a session with custom TTL", async () => {
      await service.setSession(userId, sessionData, 3600);
      expect(main.set).toHaveBeenCalledWith(
        `session:${userId}`, JSON.stringify(sessionData), "EX", 3600
      );
    });

    it("retrieves a session", async () => {
      await service.setSession(userId, sessionData);
      expect(await service.getSession<typeof sessionData>(userId)).toEqual(sessionData);
    });

    it("returns null for a non-existent session", async () => {
      expect(await service.getSession("ghost")).toBeNull();
    });

    it("deletes a session", async () => {
      await service.setSession(userId, sessionData);
      await service.deleteSession(userId);
      expect(await service.getSession(userId)).toBeNull();
    });
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────
  describe("incrementRateLimit()", () => {
    it("returns the incremented count", async () => {
      const execMock = jest.fn().mockResolvedValue([[null, 5], [null, "OK"]]);
      main.pipeline.mockReturnValueOnce({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: execMock,
      });

      expect(await service.incrementRateLimit("rl:ip:1.2.3.4", 60)).toBe(5);
    });

    it("calls INCR and EXPIRE via pipeline", async () => {
      const incrMock = jest.fn().mockReturnThis();
      const expireMock = jest.fn().mockReturnThis();
      const execMock = jest.fn().mockResolvedValue([[null, 1], [null, "OK"]]);
      main.pipeline.mockReturnValueOnce({ incr: incrMock, expire: expireMock, exec: execMock });

      await service.incrementRateLimit("rl:user:99", 30);

      expect(incrMock).toHaveBeenCalledWith("rl:user:99");
      expect(expireMock).toHaveBeenCalledWith("rl:user:99", 30);
      expect(execMock).toHaveBeenCalled();
    });
  });

  // ── Pub / Sub ─────────────────────────────────────────────────────────────
  describe("publish / subscribe", () => {
    it("publishes an object as JSON on the publisher connection", async () => {
      await service.publish("events", { type: "login" });
      expect(publisher.publish).toHaveBeenCalledWith(
        "events", JSON.stringify({ type: "login" })
      );
    });

    it("subscribes on the subscriber connection", async () => {
      await service.subscribe("events", jest.fn());
      expect(subscriber.subscribe).toHaveBeenCalledWith("events");
    });

    it("calls callback with parsed JSON message", async () => {
      const callback = jest.fn();
      await service.subscribe("ch", callback);
      messageHandler?.("ch", JSON.stringify({ hello: "world" }));
      expect(callback).toHaveBeenCalledWith({ hello: "world" });
    });

    it("ignores messages on other channels", async () => {
      const callback = jest.fn();
      await service.subscribe("ch", callback);
      messageHandler?.("other-channel", "msg");
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ── Queue ─────────────────────────────────────────────────────────────────
  describe("enqueue / dequeue", () => {
    it("enqueues an item with RPUSH", async () => {
      await service.enqueue("jobs", { action: "send-email" });
      expect(main.rpush).toHaveBeenCalledWith("jobs", JSON.stringify({ action: "send-email" }));
    });

    it("dequeues and parses an item", async () => {
      main.lpop.mockResolvedValueOnce(JSON.stringify({ action: "send-email" }));
      expect(await service.dequeue<{ action: string }>("jobs")).toEqual({ action: "send-email" });
    });

    it("returns null when queue is empty", async () => {
      main.lpop.mockResolvedValueOnce(null);
      expect(await service.dequeue("jobs")).toBeNull();
    });
  });

  // ── Online presence ───────────────────────────────────────────────────────
  describe("online presence", () => {
    it("sets online with default TTL of 30s", async () => {
      await service.setOnline("u1");
      expect(main.set).toHaveBeenCalledWith("online:u1", "1", "EX", 30);
    });

    it("sets online with custom TTL", async () => {
      await service.setOnline("u1", 60);
      expect(main.set).toHaveBeenCalledWith("online:u1", "1", "EX", 60);
    });

    it("deletes online key", async () => {
      await service.deleteOnline("u1");
      expect(main.del).toHaveBeenCalledWith("online:u1");
    });

    it("returns only online users from a list", async () => {
      main.mget.mockResolvedValueOnce(["1", null, "1"]);
      expect(await service.getOnlineUsers(["u1", "u2", "u3"])).toEqual(["u1", "u3"]);
    });

    it("returns empty array without calling mget for empty input", async () => {
      expect(await service.getOnlineUsers([])).toEqual([]);
      expect(main.mget).not.toHaveBeenCalled();
    });
  });

  // ── Expose raw clients ────────────────────────────────────────────────────
  describe("getPublisher / getSubscriber", () => {
    it("exposes the publisher Redis instance", () => {
      expect(service.getPublisher()).toBe(publisher);
    });

    it("exposes the subscriber Redis instance", () => {
      expect(service.getSubscriber()).toBe(subscriber);
    });
  });
});
