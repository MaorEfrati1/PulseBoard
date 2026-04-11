import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { redisService } from '../config/redis';
import { UnauthorizedError, ForbiddenError, TooManyRequestsError } from '../utils/errors';
import { prisma } from '../config/database';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyAccessToken(token);

    // getSession לפי userId בלבד — תואם ארכיטקטורה
    const session = await redisService.getSession<{ userId: string; role: string }>(payload.userId);
    if (!session) {
      throw new UnauthorizedError('Session expired');
    }

    // Redis מחזיר את ה-user data ישירות — אין צורך לפגוע ב-DB
    req.user = { userId: session.userId, role: session.role, email: payload.userId };

    // DB hit רק אם צריך את האימייל (אפשר להוסיף email ל-session data ב-generateTokens במקום)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = { userId: user.id, role: user.role, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }
      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError('Insufficient permissions');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function rateLimiter(max: number, windowSec: number) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = req.user?.userId ?? req.ip ?? 'anonymous';
      const key = `rate_limit:${identifier}:${req.path}`;

      const count = await redisService.incrementRateLimit(key, windowSec);
      if (count > max) {
        throw new TooManyRequestsError(`Rate limit exceeded. Max ${max} requests per ${windowSec}s`);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}