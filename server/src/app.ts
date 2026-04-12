import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import metricsRoutes from './routes/metrics.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { healthService } from './services/health.service';

export const app = express();

// ── Security / Transport ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(compression());
app.use(express.json());

// ── Metrics (must come before routes so every request is captured) ─────────────
app.use(metricsMiddleware);

// ── Health ─────────────────────────────────────────────────────────────────────
// Returns full health report: Postgres, Redis, Firebase, and system stats.
app.get('/health', async (_req, res, next) => {
  try {
    const report = await healthService.getHealthReport();

    // Mirror overall status in HTTP status code so load-balancers can act on it
    const httpStatus =
      report.status === 'healthy' ? 200 :
      report.status === 'degraded' ? 200 :   // degraded = still serving
      503;

    res.status(httpStatus).json(report);
  } catch (err) {
    next(err);
  }
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/metrics', metricsRoutes);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorMiddleware);
