import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const isDevelopment = process.env.NODE_ENV === 'development';

interface ErrorResponse {
  status: 'error' | 'fail';
  message: string;
  errors?: { field: string; message: string }[];
  stack?: string;
}

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // ZodError → 400 with field-level errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    const body: ErrorResponse = {
      status: 'fail',
      message: 'Validation failed',
      errors,
    };

    if (isDevelopment && err.stack) body.stack = err.stack;
    res.status(400).json(body);
    return;
  }

  // Prisma unique constraint violation → 409
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    const fields = (err.meta?.target as string[])?.join(', ') ?? 'field';
    const body: ErrorResponse = {
      status: 'fail',
      message: `A record with this ${fields} already exists`,
    };
    if (isDevelopment && err.stack) body.stack = err.stack;
    res.status(409).json(body);
    return;
  }

  // Prisma record not found → 404
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2025'
  ) {
    const body: ErrorResponse = {
      status: 'fail',
      message: 'Resource not found',
    };
    if (isDevelopment && err.stack) body.stack = err.stack;
    res.status(404).json(body);
    return;
  }

  // Operational AppError → use its statusCode + message
  if (err instanceof AppError && err.isOperational) {
    const body: ErrorResponse = {
      status: err.statusCode < 500 ? 'fail' : 'error',
      message: err.message,
    };
    if (isDevelopment && err.stack) body.stack = err.stack;
    res.status(err.statusCode).json(body);
    return;
  }

  // Unknown / programmer error → 500, hide details
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled error', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  const body: ErrorResponse = {
    status: 'error',
    message: 'Internal server error',
  };

  if (isDevelopment) body.stack = error.stack;
  res.status(500).json(body);
};
