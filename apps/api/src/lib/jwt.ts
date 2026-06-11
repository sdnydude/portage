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
const REFRESH_TOKEN_EXPIRY = '30d';
export const STAY_LOGGED_IN_EXPIRY = '365d';
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const STAY_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env().JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(payload: JwtPayload, expiresIn: string = REFRESH_TOKEN_EXPIRY): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env().JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
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
