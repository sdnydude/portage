import { signAccessToken, type JwtPayload } from '../lib/jwt.js';

export function createTestUser(overrides?: Partial<JwtPayload>): JwtPayload {
  return {
    sub: 'test-user-id',
    email: 'test@example.com',
    tier: 'pro',
    role: 'user',
    ...overrides,
  };
}

export function createTestToken(overrides?: Partial<JwtPayload>): string {
  return signAccessToken(createTestUser(overrides));
}
