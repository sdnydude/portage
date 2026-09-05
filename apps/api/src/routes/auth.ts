import { createHash } from 'node:crypto';
import { Router, type Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { eq, sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { env } from '../lib/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { signAccessToken } from '../lib/jwt.js';
import { AppError } from '../middleware/error.js';
import { verifyCfAccessJwt } from '../lib/cf-access.js';

const logger = createLogger('auth');

// The exchange runs on every page load (mount-time bootstrap), and Cloudflare
// Access has already authenticated the caller — there is no credential to
// brute-force. Generous ceiling to absorb reloads and multi-tab sessions;
// several testers can share one NAT IP.
// Per-identity limiter key: the CF assertion is per-user and rides every
// CF-fronted request, so hashing it isolates each user's budget — one
// misbehaving client can no longer starve everyone behind the shared
// /backend proxy IP (2026-07-27 incident). Forged assertions get their own
// bucket but die in the handler, and the coarse per-IP tier bounds them.
export function sessionRateLimitKey(req: Request): string {
  const assertion = req.headers['cf-access-jwt-assertion'];
  if (typeof assertion === 'string' && assertion.length > 0) {
    return createHash('sha256').update(assertion).digest('hex');
  }
  // Dev bypass (LAN/CI) has no assertion but authenticates as one identity —
  // key on it so those runs don't share the proxy-IP bucket.
  if (env().NODE_ENV === 'development' && env().CF_ACCESS_DEV_EMAIL) {
    return `dev:${env().CF_ACCESS_DEV_EMAIL}`;
  }
  return req.ip ? ipKeyGenerator(req.ip) : 'unknown';
}

// Tier 1 — coarse per-IP cap. The per-identity key below is attacker-mintable
// (a fresh forged assertion per request = a fresh bucket), so this tier is
// what actually bounds /auth/session load (each request costs a JWKS verify).
const sessionIpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 5000 : 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // cloudflared sets X-Forwarded-For but we key by identity/raw ip, not XFF.
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many session requests, please try again later', code: 'RATE_LIMITED' },
});

// Tier 2 — per-identity budget (see sessionRateLimitKey above).
const sessionLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: sessionRateLimitKey,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many session requests, please try again later', code: 'RATE_LIMITED' },
});

export const authRouter = Router();

// Cloudflare Access identity exchange: the edge validates the user against the
// IdP + Access policy and forwards Cf-Access-Jwt-Assertion; we verify it against
// the team JWKS, map the user row by email, and mint the same internal access
// token the rest of the API already consumes.
authRouter.get('/session', sessionIpLimiter, sessionLimiter, async (req, res, next) => {
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
      // common_name. Only the EXPECTED common_name maps to the service
      // identity — any other service token on this Access app is rejected,
      // otherwise it could impersonate the configured service user.
      const serviceEmail = env().CF_ACCESS_SERVICE_EMAIL;
      const serviceCn = env().CF_ACCESS_SERVICE_COMMON_NAME;
      rawEmail = identity.email
        ?? (identity.commonName && serviceEmail && serviceCn && identity.commonName === serviceCn
          ? serviceEmail
          : null);
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
      // Concurrent first logins (multi-tab mounts) race on unique(email):
      // the loser's insert is a no-op and reselects the winner's row.
      [user] = await db.insert(users).values({
        email,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).onConflictDoNothing().returning();
      if (user) {
        logger.info({ userId: user.id, email }, 'User auto-provisioned from Cloudflare Access');
      } else {
        [user] = await db.select()
          .from(users)
          .where(sql`lower(email) = ${email}`)
          .limit(1);
        if (!user) {
          throw new AppError(500, 'PROVISION_FAILED', 'Could not establish the account');
        }
      }
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
