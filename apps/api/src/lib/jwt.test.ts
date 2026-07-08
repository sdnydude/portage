import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
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

    it('rejects a legacy refresh token used as access token', () => {
      const refreshToken = jwt.sign(
        { ...testPayload, type: 'refresh' },
        env().JWT_SECRET,
        { expiresIn: '1h' },
      );
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
});
