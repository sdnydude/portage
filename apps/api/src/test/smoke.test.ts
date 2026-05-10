import { createTestToken, createTestUser } from './helpers.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { env } from '../lib/env.js';

describe('test infrastructure smoke test', () => {
  it('env is loaded with test values', () => {
    expect(env().NODE_ENV).toBe('test');
    expect(env().JWT_SECRET).toBe('test-jwt-secret-must-be-at-least-32-characters');
  });

  it('JWT helper creates valid tokens', () => {
    const token = createTestToken();
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('test-user-id');
    expect(payload.email).toBe('test@example.com');
  });

  it('user factory accepts overrides', () => {
    const admin = createTestUser({ role: 'admin', tier: 'free' });
    expect(admin.role).toBe('admin');
    expect(admin.tier).toBe('free');
    expect(admin.email).toBe('test@example.com');
  });
});
