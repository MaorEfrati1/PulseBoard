import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { redisService } from '../config/redis';
import { ConflictError, UnauthorizedError } from '../utils/errors';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  role: string;
}

export interface SessionData {
  userId: string;
  role: string;
  email: string;
}

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
const BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export class AuthService {
  async register(email: string, password: string, name: string): Promise<TokenPair> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    const user = await prisma.user.create({
      data: { email, passwordHash: hashedPassword, name },
    });

    return this.generateTokens(user.id, user.role, user.email);
  }

  async login(email: string, password: string, deviceInfo?: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials or inactive account');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return this.generateTokens(user.id, user.role, user.email, deviceInfo);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { select: { email: true } } },
    });
    if (!session) {
      throw new UnauthorizedError('Session not found or already used');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedError('Session expired');
    }

    await prisma.session.delete({ where: { id: session.id } });
    await redisService.deleteSession(session.userId);

    return this.generateTokens(payload.userId, payload.role, session.user.email);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await Promise.all([
      redisService.deleteSession(userId),
      prisma.session.deleteMany({ where: { userId, refreshToken } }),
    ]);
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid access token');
    }
  }

  private async generateTokens(
    userId: string,
    role: string,
    email: string,
    deviceInfo?: string
  ): Promise<TokenPair> {
    const payload: JwtPayload = { userId, role };

    const accessToken = jwt.sign(
      { ...payload, jti: uuidv4() },  // ← jti ייחודי
      ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    const refreshToken = jwt.sign(
      { ...payload, jti: uuidv4() },  // ← jti ייחודי
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_TTL }
    );

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await Promise.all([
      prisma.session.create({
        data: {
          id: uuidv4(),
          userId,
          refreshToken,
          deviceInfo: deviceInfo ?? null,
          expiresAt,
        },
      }),
      redisService.setSession(userId, { userId, role, email }, REFRESH_TOKEN_TTL_SECONDS),
    ]);

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();