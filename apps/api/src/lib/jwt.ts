import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from './env.js';

export interface JwtPayload {
  sub: string;
  email: string;
  tier: 'free' | 'pro';
  role: 'user' | 'admin';
}

const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '30d';

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env().JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env().JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env().JWT_SECRET) as JwtPayload & { type?: string };
  if (decoded.type === 'refresh') {
    throw new Error('Cannot use refresh token as access token');
  }
  return { sub: decoded.sub, email: decoded.email, tier: decoded.tier, role: decoded.role || 'user' };
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env().JWT_SECRET) as JwtPayload & { type?: string };
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return { sub: decoded.sub, email: decoded.email, tier: decoded.tier, role: decoded.role || 'user' };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
