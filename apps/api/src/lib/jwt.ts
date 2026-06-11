import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from './env.js';

export interface JwtPayload {
  sub: string;
  email: string;
  tier: 'free' | 'pro';
  role: 'user' | 'admin';
  trialEndsAt?: string;
}

const ACCESS_TOKEN_EXPIRY = '15m';
// Single source of truth for refresh-session durations: milliseconds.
// JWT exp and refresh_tokens.expires_at both derive from the same ttlMs.
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const STAY_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env().JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(payload: JwtPayload, ttlMs: number = REFRESH_TTL_MS): string {
  // jti guarantees uniqueness — without it, two logins in the same second
  // produce byte-identical JWTs and collide on the refresh_tokens.token_hash
  // unique constraint. expiresIn in seconds derives from the same ttlMs the
  // caller uses for the DB expires_at, so the two cannot drift.
  return jwt.sign({ ...payload, type: 'refresh', jti: crypto.randomUUID() }, env().JWT_SECRET, { expiresIn: Math.floor(ttlMs / 1000) });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env().JWT_SECRET) as JwtPayload & { type?: string };
  if (decoded.type === 'refresh') {
    throw new Error('Cannot use refresh token as access token');
  }
  return { sub: decoded.sub, email: decoded.email, tier: decoded.tier, role: decoded.role || 'user', trialEndsAt: decoded.trialEndsAt };
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env().JWT_SECRET) as JwtPayload & { type?: string };
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return { sub: decoded.sub, email: decoded.email, tier: decoded.tier, role: decoded.role || 'user', trialEndsAt: decoded.trialEndsAt };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
