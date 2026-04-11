import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Async handler wrapper to catch promise rejections
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// --- Validation Schemas ---

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  name: z.string().min(2).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceInfo: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const logoutSchema = z.object({
  refreshToken: z.string(),
});

// --- Routes ---

/**
 * POST /auth/register
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = registerSchema.parse(req.body);
    const data = await authService.register(email, password, name);
    res.status(201).json({ status: 'success', data });
  })
);

/**
 * POST /auth/login
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, deviceInfo } = loginSchema.parse(req.body);
    const data = await authService.login(email, password, deviceInfo);
    res.status(200).json({ status: 'success', data });
  })
);

/**
 * POST /auth/refresh
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const data = await authService.refresh(refreshToken);
    res.status(200).json({ status: 'success', data });
  })
);

/**
 * POST /auth/logout  (protected)
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await authService.logout(req.user!.userId, refreshToken);
    res.status(200).json({ status: 'success', data: null });
  })
);

export default router;
