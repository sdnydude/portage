import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../lib/jwt.js';
import { AppError } from '../middleware/error.js';

const logger = pino({ name: 'auth' });

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (existing.length > 0) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }

    const passwordHash = await hashPassword(body.password);

    const [user] = await db.insert(users).values({
      email: body.email,
      passwordHash,
    }).returning({
      id: users.id,
      email: users.email,
      subscriptionTier: users.subscriptionTier,
      role: users.role,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
    });

    const jwtPayload = { sub: user.id, email: user.email, tier: user.subscriptionTier, role: user.role };
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
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (!user) {
      logger.warn({ email: body.email }, 'Login attempt for non-existent email');
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      logger.warn({ userId: user.id }, 'Login attempt with wrong password');
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.disabledAt) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
    }

    const jwtPayload = { sub: user.id, email: user.email, tier: user.subscriptionTier, role: user.role };
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
        aiScansThisMonth: user.aiScansThisMonth,
        bgRemovalsThisMonth: user.bgRemovalsThisMonth,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
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

    const jwtPayload = { sub: user.id, email: user.email, tier: user.subscriptionTier, role: user.role };
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
        aiScansThisMonth: user.aiScansThisMonth,
        bgRemovalsThisMonth: user.bgRemovalsThisMonth,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});
