import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  STAY_LOGGED_IN_EXPIRY,
  REFRESH_TTL_MS,
  STAY_TTL_MS,
  type JwtPayload,
} from './jwt.js';
import { env } from './env.js';

const testPayload: JwtPayload = {
  sub: 'user-123',
  email: 'test@example.com',
  tier: 'pro',
  role: 'admin',
};

describe('jwt', () => {
  describe('access tokens', () => {
    it('sign and verify roundtrip preserves payload fields', () => {
      const token = signAccessToken(testPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.tier).toBe(testPayload.tier);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('rejects a refresh token used as access token', () => {
      const refreshToken = signRefreshToken(testPayload);
      expect(() => verifyAccessToken(refreshToken)).toThrow('Cannot use refresh token as access token');
    });

    it('throws on garbage string', () => {
      expect(() => verifyAccessToken('not.a.token')).toThrow();
    });

    it('defaults missing role to user', () => {
      const token = jwt.sign(
        { sub: 'u1', email: 'a@b.com', tier: 'free' },
        env().JWT_SECRET,
        { expiresIn: '1h' },
      );
      const decoded = verifyAccessToken(token);
      expect(decoded.role).toBe('user');
    });
  });

  describe('refresh tokens', () => {
    it('sign and verify roundtrip preserves payload fields', () => {
      const token = signRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('rejects an access token used as refresh token', () => {
      const accessToken = signAccessToken(testPayload);
      expect(() => verifyRefreshToken(accessToken)).toThrow('Invalid refresh token');
    });

    it('default refresh token expires in 30 days', () => {
      const token = signRefreshToken(testPayload);
      const decoded = jwt.decode(token) as { iat: number; exp: number };
      expect(decoded.exp - decoded.iat).toBe(REFRESH_TTL_MS / 1000);
    });

    it('stay-logged-in refresh token expires in 365 days', () => {
      const token = signRefreshToken(testPayload, STAY_LOGGED_IN_EXPIRY);
      const decoded = jwt.decode(token) as { iat: number; exp: number };
      expect(decoded.exp - decoded.iat).toBe(STAY_TTL_MS / 1000);
    });

    it('TTL constants match their durations', () => {
      expect(REFRESH_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
      expect(STAY_TTL_MS).toBe(365 * 24 * 60 * 60 * 1000);
    });
  });

  describe('hashToken', () => {
    it('is deterministic', () => {
      const hash1 = hashToken('my-token');
      const hash2 = hashToken('my-token');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });
});
