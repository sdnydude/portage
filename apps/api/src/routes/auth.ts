import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../lib/jwt.js';
import { AppError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';

const logger = createLogger('auth');

const DUMMY_HASH = '$2b$12$LJ3m4ys3Lk0TSwMBEW/yWeGHnFnCMXhPsPryBa8KiRFqLFBdujGXS';

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 100 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later', code: 'RATE_LIMITED' },
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address').transform(e => e.toLowerCase().trim()),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase().trim()),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await db.select({ id: users.id })
      .from(users)
      .where(sql`lower(email) = ${body.email}`)
      .limit(1);

    if (existing.length > 0) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }

    const passwordHash = await hashPassword(body.password);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [user] = await db.insert(users).values({
      email: body.email,
      passwordHash,
      trialEndsAt,
    }).returning({
      id: users.id,
      email: users.email,
      subscriptionTier: users.subscriptionTier,
      role: users.role,
      onboardingCompleted: users.onboardingCompleted,
      trialEndsAt: users.trialEndsAt,
      createdAt: users.createdAt,
    });

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      tier: user.subscriptionTier,
      role: user.role,
      trialEndsAt: user.trialEndsAt?.toISOString(),
    };
    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

    await db.update(users)
      .set({ refreshTokenHash: hashToken(refreshToken) })
      .where(eq(users.id, user.id));

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    res.status(201).json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        trialEndsAt: user.trialEndsAt,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const [user] = await db.select()
      .from(users)
      .where(sql`lower(email) = ${body.email}`)
      .limit(1);

    if (!user) {
      await verifyPassword(body.password, DUMMY_HASH);
      logger.warn({ email: body.email }, 'Login attempt for non-existent email');
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.disabledAt) {
      await verifyPassword(body.password, user.passwordHash);
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      logger.warn({ userId: user.id }, 'Login attempt with wrong password');
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      tier: user.subscriptionTier,
      role: user.role,
      trialEndsAt: user.trialEndsAt?.toISOString(),
    };
    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

    await db.update(users)
      .set({ refreshTokenHash: hashToken(refreshToken), lastActiveAt: new Date() })
      .where(eq(users.id, user.id));

    logger.info({ userId: user.id }, 'User logged in');

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        subscriptionTier: user.subscriptionTier,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        trialEndsAt: user.trialEndsAt,
        aiScansThisMonth: user.aiScansThisMonth,
        aiListingsThisMonth: user.aiListingsThisMonth,
        aiListingCredits: user.aiListingCredits,
        bgRemovalsThisMonth: user.bgRemovalsThisMonth,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);

    let payload;
    try {
      payload = verifyRefreshToken(body.refreshToken);
    } catch {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'User not found');
    }

    const tokenHash = hashToken(body.refreshToken);
    if (user.refreshTokenHash !== tokenHash) {
      logger.warn({ userId: user.id }, 'Refresh token hash mismatch — possible token reuse');
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has been revoked');
    }

    if (user.disabledAt) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
    }

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      tier: user.subscriptionTier,
      role: user.role,
      trialEndsAt: user.trialEndsAt?.toISOString(),
    };
    const accessToken = signAccessToken(jwtPayload);
    const newRefreshToken = signRefreshToken(jwtPayload);

    await db.update(users)
      .set({ refreshTokenHash: hashToken(newRefreshToken) })
      .where(eq(users.id, user.id));

    logger.info({ userId: user.id }, 'Token refreshed');

    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        subscriptionTier: user.subscriptionTier,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        trialEndsAt: user.trialEndsAt,
        aiScansThisMonth: user.aiScansThisMonth,
        aiListingsThisMonth: user.aiListingsThisMonth,
        aiListingCredits: user.aiListingCredits,
        bgRemovalsThisMonth: user.bgRemovalsThisMonth,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    await db.update(users)
      .set({ refreshTokenHash: null })
      .where(eq(users.id, userId));

    logger.info({ userId }, 'User logged out — refresh token revoked');

    res.json({ loggedOut: true });
  } catch (err) {
    next(err);
  }
});
