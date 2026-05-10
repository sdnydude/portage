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

  it('passes 401 to next for missing Authorization header', () => {
    const req = mockReq();
    requireAuth(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    const err = vi.mocked(mockNext).mock.calls[0][0] as unknown as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('passes 401 to next for malformed header without Bearer prefix', () => {
    const req = mockReq({ authorization: 'Token abc123' });
    requireAuth(req, mockRes, mockNext);
    const err = vi.mocked(mockNext).mock.calls[0][0] as unknown as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('passes 401 to next for expired token', () => {
    const token = jwt.sign(
      { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user' },
      env().JWT_SECRET,
      { expiresIn: '0s' },
    );
    const req = mockReq({ authorization: `Bearer ${token}` });
    requireAuth(req, mockRes, mockNext);
    const err = vi.mocked(mockNext).mock.calls[0][0] as unknown as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('passes 401 to next when refresh token is used as access token', () => {
    const token = jwt.sign(
      { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user', type: 'refresh' },
      env().JWT_SECRET,
      { expiresIn: '1h' },
    );
    const req = mockReq({ authorization: `Bearer ${token}` });
    requireAuth(req, mockRes, mockNext);
    const err = vi.mocked(mockNext).mock.calls[0][0] as unknown as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });
});

describe('requirePro', () => {
  it('calls next for pro user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user' };

    requirePro(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('passes 403 to next for free user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'free', role: 'user' };

    requirePro(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    const err = vi.mocked(mockNext).mock.calls[0][0] as unknown as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('PRO_REQUIRED');
  });
});

describe('requireAdmin', () => {
  it('calls next for admin user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'admin' };

    requireAdmin(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('passes 403 to next for non-admin user', () => {
    const req = mockReq();
    req.user = { sub: 'u1', email: 'a@b.com', tier: 'pro', role: 'user' };

    requireAdmin(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    const err = vi.mocked(mockNext).mock.calls[0][0] as unknown as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ADMIN_REQUIRED');
  });
});
