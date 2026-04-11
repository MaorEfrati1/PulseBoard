import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import { errorMiddleware } from './middleware/error.middleware';

export const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(compression());
app.use(express.json());

// Health
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);

// Error handler
app.use(errorMiddleware);
