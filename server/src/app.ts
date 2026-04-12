import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorMiddleware } from './middleware/error.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { healthService } from './services/health.service';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import taskRoutes from './routes/task.routes';
import activityRoutes from './routes/activity.routes';
import aiRoutes from './routes/ai.routes';
import metricsRoutes from './routes/metrics.routes';

export const app = express();

// ── Security / Transport ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json());

// ── Metrics (before routes — captures every request) ──────────────────────────
app.use(metricsMiddleware);

// ── Request logging ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.info(
      `[http] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });
  next();
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res, next) => {
  try {
    const report = await healthService.getHealthReport();
    const httpStatus =
      report.status === 'healthy' ? 200 :
      report.status === 'degraded' ? 200 :   // degraded = still serving
      503;
    res.status(httpStatus).json(report);
  } catch (err) {
    next(err);
  }
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/users',    userRoutes);
app.use('/api/v1/tasks',    taskRoutes);
app.use('/api/v1/activity', activityRoutes);
app.use('/api/v1/ai',       aiRoutes);
app.use('/api/v1/metrics',  metricsRoutes);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorMiddleware);
