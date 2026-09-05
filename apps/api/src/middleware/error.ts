import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createLogger } from '../lib/logger.js';
import { EbayTradingError } from '../marketplace/ebay-trading-client.js';

const logger = createLogger('error-handler');

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined && { details: err.details }),
    });
    return;
  }

  if (err instanceof ZodError) {
    const messages = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: messages });
    return;
  }

  if (err instanceof EbayTradingError) {
    // eBay's rejection text is actionable seller guidance — surface it as a
    // 422 instead of a generic 500 (prod incident 2026-08-25: error 240
    // "accessory in tablet title" reached the UI as "Internal server error").
    res.status(422).json({
      error: err.message,
      code: 'EBAY_REJECTED',
      details: err.errorCodes,
    });
    return;
  }

  logger.error(err, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}
