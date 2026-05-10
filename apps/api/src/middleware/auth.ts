import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt.js';
import { createLogger } from '../lib/logger.js';
import { AppError } from './error.js';

const logger = createLogger('auth-middleware');

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header'));
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'JWT verification failed');
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}

export function requirePro(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
  if (req.user.tier !== 'pro') {
    return next(new AppError(403, 'PRO_REQUIRED', 'Pro subscription required'));
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
  if (req.user.role !== 'admin') {
    logger.warn({ userId: req.user.sub }, 'Non-admin attempted admin access');
    return next(new AppError(403, 'ADMIN_REQUIRED', 'Admin access required'));
  }
  next();
}
