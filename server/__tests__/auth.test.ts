import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/config/database";
import { redisService } from "../src/config/redis";

const BASE = "/api/v1/auth";

const validUser = {
  email: "test@example.com",
  password: "Password1",
  name: "Test User",
};

// Cleans up all auth-related data between tests that register users.
// Does NOT call flushAll — preserves any unrelated Redis state.
const clearUsers = async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { email: validUser.email } });
  await redisService.invalidatePattern('session:*');
};

// ---------------------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------------------

describe("POST /auth/register", () => {
  afterEach(clearUsers);

  it("happy path — returns 201 with token pair", async () => {
    const res = await request(app).post(`${BASE}/register`).send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
  });

  it("duplicate email — returns 409", async () => {
    await request(app).post(`${BASE}/register`).send(validUser);

    const res = await request(app).post(`${BASE}/register`).send(validUser);
    expect(res.status).toBe(409);
  });

  it("weak password (no uppercase) — returns 400", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ ...validUser, password: "password1" });

    expect(res.status).toBe(400);
  });

  it("weak password (no digit) — returns 400", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ ...validUser, password: "PasswordOnly" });

    expect(res.status).toBe(400);
  });

  it("short password — returns 400", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ ...validUser, password: "Ab1" });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post(`${BASE}/register`).send(validUser);
  });

  afterEach(clearUsers);

  it("valid credentials — returns 200 with token pair", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
  });

  it("wrong password — returns 401", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: validUser.email, password: "WrongPass9" });

    expect(res.status).toBe(401);
  });

  it("inactive user — returns 401", async () => {
    await prisma.user.update({
      where: { email: validUser.email },
      data: { isActive: false },
    });

    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(401);
  });

  it("unknown email — returns 401", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: "nobody@example.com", password: validUser.password });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// REFRESH
// ---------------------------------------------------------------------------

describe("POST /auth/refresh", () => {
  let refreshToken: string;

  beforeEach(async () => {
    const res = await request(app).post(`${BASE}/register`).send(validUser);
    refreshToken = res.body.data.refreshToken;
  });

  afterEach(clearUsers);

  it("valid token — returns new token pair", async () => {
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it("already used token (token rotation) — returns 401", async () => {
    await request(app).post(`${BASE}/refresh`).send({ refreshToken });

    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it("expired / invalid token — returns 401", async () => {
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken: "totally.invalid.token" });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------

describe("POST /auth/logout", () => {
  let accessToken: string;
  let refreshToken: string;

  beforeEach(async () => {
    const res = await request(app).post(`${BASE}/register`).send(validUser);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  afterEach(clearUsers);

  it("removes session from Redis and DB", async () => {
    const logoutRes = await request(app)
      .post(`${BASE}/logout`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    const refreshRes = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it("missing auth header — returns 401", async () => {
    const res = await request(app)
      .post(`${BASE}/logout`)
      .send({ refreshToken });
    expect(res.status).toBe(401);
  });
});
