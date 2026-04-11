import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validate middleware factory
 *
 * Accepts a Zod schema describing the expected shape of { body?, query?, params? }.
 * If validation passes — hydrates req with parsed values (including defaults).
 * If it fails   — returns 400 with a detailed error list.
 *
 * HTTP 400 (Bad Request) is the correct status for malformed client input.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Hydrate req with parsed + defaulted values
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) req.query = result.data.query;
    if (result.data.params !== undefined) req.params = result.data.params;

    next();
  };

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ValidationError {
  field: string;
  message: string;
}

function formatZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    // e.g. ["body", "title"] → "body.title"
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
