import jwt from 'jsonwebtoken';
import { env } from './env.js';

export interface JwtPayload {
  sub: string;
  email: string;
  tier: 'free' | 'pro';
  role: 'user' | 'admin';
  trialEndsAt?: string;
}

// Short-lived by design: Cloudflare Access is the session layer. The web app
// re-exchanges its CF identity at GET /auth/session whenever this expires.
const ACCESS_TOKEN_EXPIRY = '15m';

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env().JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env().JWT_SECRET) as JwtPayload & { type?: string };
  if (decoded.type === 'refresh') {
    throw new Error('Cannot use refresh token as access token');
  }
  return { sub: decoded.sub, email: decoded.email, tier: decoded.tier, role: decoded.role || 'user', trialEndsAt: decoded.trialEndsAt };
}
