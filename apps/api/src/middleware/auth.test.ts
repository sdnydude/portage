import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requirePro, requireAdmin } from './auth.js';
import { AppError } from './error.js';
import { createTestToken } from '../test/helpers.js';
import { env } from '../lib/env.js';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers, user: undefined } as unknown as Request;
}

const mockRes = {} as Response;
const mockNext: NextFunction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth', () => {
  it('sets req.user and calls next for valid token', () => {
    const token = createTestToken({ role: 'user', tier: 'pro' });
    const req = mockReq({ authorization: `Bearer ${token}` });

    requireAuth(req, mockRes, mockNext);

    expect(req.user).toBeDefined();
    expect(req.user!.sub).toBe('test-user-id');
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('throws 401 for missing Authorization header', () => {
    const req = mockReq();
    expect(() => requireAuth(req, mockRes, mockNext)).toThrow(AppError);
    try { requireAuth(req, mockRes, mockNext); } catch (e) {
      expect((e as AppError).statusCode).toBe(401);
      expect((e as AppError).code).toBe('UNAUTHORIZED');
    }
  });

  it('throws 401 for malformed header without Bearer prefix', () => {
    const req = mockReq({ authorization: 'Token abc123' });
    expect(() => requireAuth(req, mockRes, mockNext)).toThrow(AppError);
  });

  it('throws 401 for expired token', () => {
    const token = jwt.sign(
      { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user' },
      env().JWT_SECRET,
      { expiresIn: '0s' },
    );
    const req = mockReq({ authorization: `Bearer ${token}` });
    expect(() => requireAuth(req, mockRes, mockNext)).toThrow(AppError);
  });

  it('throws 401 when refresh token is used as access token', () => {
    const token = jwt.sign(
      { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user', type: 'refresh' },
      env().JWT_SECRET,
      { expiresIn: '1h' },
    );
    const req = mockReq({ authorization: `Bearer ${token}` });
    expect(() => requireAuth(req, mockRes, mockNext)).toThrow(AppError);
  });
});

describe('requirePro', () => {
  it('calls next for pro user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user' };

    requirePro(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('throws 403 for free user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'free', role: 'user' };

    expect(() => requirePro(req, mockRes, mockNext)).toThrow(AppError);
    try { requirePro(req, mockRes, mockNext); } catch (e) {
      expect((e as AppError).statusCode).toBe(403);
      expect((e as AppError).code).toBe('PRO_REQUIRED');
    }
  });
});

describe('requireAdmin', () => {
  it('calls next for admin user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'admin' };

    requireAdmin(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('throws 403 for non-admin user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user' };

    expect(() => requireAdmin(req, mockRes, mockNext)).toThrow(AppError);
    try { requireAdmin(req, mockRes, mockNext); } catch (e) {
      expect((e as AppError).statusCode).toBe(403);
      expect((e as AppError).code).toBe('ADMIN_REQUIRED');
    }
  });
});
