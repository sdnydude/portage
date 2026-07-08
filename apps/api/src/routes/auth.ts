import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { eq, sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { env } from '../lib/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { signAccessToken } from '../lib/jwt.js';
import { AppError } from '../middleware/error.js';
import { verifyCfAccessJwt } from '../lib/cf-access.js';

const logger = createLogger('auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 100 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later', code: 'RATE_LIMITED' },
});

export const authRouter = Router();

// Cloudflare Access identity exchange: the edge validates the user against the
// IdP + Access policy and forwards Cf-Access-Jwt-Assertion; we verify it against
// the team JWKS, map the user row by email, and mint the same internal access
// token the rest of the API already consumes.
authRouter.get('/session', authLimiter, async (req, res, next) => {
  try {
    const assertion = req.headers['cf-access-jwt-assertion'];
    let rawEmail: string | null = null;

    if (typeof assertion === 'string' && assertion.length > 0) {
      let identity;
      try {
        identity = await verifyCfAccessJwt(assertion);
      } catch (err) {
        logger.warn({ error: (err as Error).message }, 'CF Access JWT verification failed');
        throw new AppError(401, 'CF_INVALID', 'Cloudflare Access token is invalid');
      }
      // Interactive IdP logins carry an email; service tokens (e2e) carry a
      // common_name and map to the configured service identity, if any.
      rawEmail = identity.email
        ?? (identity.commonName ? env().CF_ACCESS_SERVICE_EMAIL ?? null : null);
    } else if (env().NODE_ENV === 'development' && env().CF_ACCESS_DEV_EMAIL) {
      // LAN dev runs without a Cloudflare edge in front. NODE_ENV gating means
      // this identity can never authenticate in prod or test.
      rawEmail = env().CF_ACCESS_DEV_EMAIL!;
    }

    if (!rawEmail) {
      throw new AppError(401, 'CF_REQUIRED', 'Cloudflare Access authentication required');
    }
    const email = rawEmail.toLowerCase().trim();

    let [user] = await db.select()
      .from(users)
      .where(sql`lower(email) = ${email}`)
      .limit(1);

    if (!user) {
      // First login through Cloudflare Access — provision the account. The
      // Access policy allowlist is the signup gate; anyone who passes it gets
      // a row plus the standard 7-day Pro trial. No password: CF is the IdP.
      [user] = await db.insert(users).values({
        email,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();
      logger.info({ userId: user.id, email }, 'User auto-provisioned from Cloudflare Access');
    }

    if (user.disabledAt) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
    }

    await db.update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, user.id));

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      tier: user.subscriptionTier,
      role: user.role,
      trialEndsAt: user.trialEndsAt?.toISOString(),
    });

    res.json({
      token,
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
