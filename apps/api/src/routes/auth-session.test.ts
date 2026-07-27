import request from 'supertest';
import type { Request } from 'express';
import { createApp } from '../app.js';
import { sessionRateLimitKey } from './auth.js';
import { db } from '../db/index.js';
import { verifyCfAccessJwt } from '../lib/cf-access.js';
import { loadEnv, resetEnv } from '../lib/env.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/cf-access.js', () => ({
  verifyCfAccessJwt: vi.fn(),
}));

function mockSelectReturns(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function mockUpdateReturns() {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as any);
}

const existingUser = {
  id: 'user-1',
  email: 'tester@example.com',
  displayName: null,
  subscriptionTier: 'free',
  role: 'user',
  onboardingCompleted: false,
  trialEndsAt: null,
  aiScansThisMonth: 0,
  aiListingsThisMonth: 0,
  aiListingCredits: 0,
  bgRemovalsThisMonth: 0,
  disabledAt: null,
  createdAt: new Date('2026-01-01'),
};

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /auth/session', () => {
  it('returns 200 with internal token and user for a valid CF Access assertion', async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: 'tester@example.com', commonName: null });
    mockSelectReturns([existingUser]);
    mockUpdateReturns();

    const res = await request(app)
      .get('/auth/session')
      .set('cf-access-jwt-assertion', 'cf-jwt');

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBe('user-1');
    expect(res.body.user.email).toBe('tester@example.com');
    expect(vi.mocked(verifyCfAccessJwt)).toHaveBeenCalledWith('cf-jwt');
  });

  it('auto-provisions a user row when the CF identity has no account yet', async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: 'fresh@example.com', commonName: null });
    mockSelectReturns([]);
    const values = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...existingUser, id: 'user-2', email: 'fresh@example.com' }]),
      }),
    });
    vi.mocked(db.insert).mockReturnValue({ values } as any);
    mockUpdateReturns();

    const res = await request(app)
      .get('/auth/session')
      .set('cf-access-jwt-assertion', 'cf-jwt');

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-2');
    expect(res.body.user.email).toBe('fresh@example.com');
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      email: 'fresh@example.com',
      trialEndsAt: expect.any(Date),
    }));
  });

  it('survives a provisioning race — concurrent first logins reselect instead of erroring', async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: 'fresh@example.com', commonName: null });
    const raceUser = { ...existingUser, id: 'user-race', email: 'fresh@example.com' };
    // First select: no row yet. Second select (after conflicted insert): the
    // row the concurrent request created.
    const limit = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([raceUser]);
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) }),
    } as any);
    // Insert lost the race: onConflictDoNothing returns no rows
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    mockUpdateReturns();

    const res = await request(app)
      .get('/auth/session')
      .set('cf-access-jwt-assertion', 'cf-jwt');

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-race');
  });

  it('returns 403 ACCOUNT_DISABLED for a disabled account', async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: 'tester@example.com', commonName: null });
    mockSelectReturns([{ ...existingUser, disabledAt: new Date('2026-06-01') }]);

    const res = await request(app)
      .get('/auth/session')
      .set('cf-access-jwt-assertion', 'cf-jwt');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('returns 401 CF_REQUIRED when the assertion header is missing', async () => {
    const res = await request(app).get('/auth/session');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('CF_REQUIRED');
    expect(vi.mocked(verifyCfAccessJwt)).not.toHaveBeenCalled();
  });

  it('returns 401 CF_INVALID when CF JWT verification fails', async () => {
    vi.mocked(verifyCfAccessJwt).mockRejectedValue(new Error('bad signature'));

    const res = await request(app)
      .get('/auth/session')
      .set('cf-access-jwt-assertion', 'tampered');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('CF_INVALID');
  });
});

describe('GET /auth/session response shape', () => {
  it('returns the full user payload and stamps lastActiveAt', async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: 'tester@example.com', commonName: null });
    mockSelectReturns([existingUser]);
    const setFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as any);

    const res = await request(app)
      .get('/auth/session')
      .set('cf-access-jwt-assertion', 'cf-jwt');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: 'user-1',
      email: 'tester@example.com',
      displayName: null,
      subscriptionTier: 'free',
      role: 'user',
      onboardingCompleted: false,
      trialEndsAt: null,
      aiScansThisMonth: 0,
      aiListingsThisMonth: 0,
      aiListingCredits: 0,
      bgRemovalsThisMonth: 0,
    });
    expect(setFn).toHaveBeenCalledWith(expect.objectContaining({ lastActiveAt: expect.any(Date) }));
  });
});

describe('GET /auth/session dev bypass', () => {
  afterEach(() => {
    delete process.env.CF_ACCESS_DEV_EMAIL;
    process.env.NODE_ENV = 'test';
    resetEnv();
    loadEnv();
  });

  it('authenticates as CF_ACCESS_DEV_EMAIL without a header in development only', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CF_ACCESS_DEV_EMAIL = 'dev@portage.local';
    resetEnv();
    loadEnv();
    mockSelectReturns([{ ...existingUser, email: 'dev@portage.local' }]);
    mockUpdateReturns();

    const res = await request(app).get('/auth/session');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('dev@portage.local');
    expect(vi.mocked(verifyCfAccessJwt)).not.toHaveBeenCalled();
  });
});

describe('GET /auth/session identity edge cases', () => {
  it('returns 401 CF_REQUIRED for a service-token identity with no email mapping', async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: null, commonName: 'e2e-service-token' });

    const res = await request(app)
      .get('/auth/session')
      .set('cf-access-jwt-assertion', 'cf-jwt');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('CF_REQUIRED');
  });

  it('maps only the configured common_name to the service email — other service tokens are rejected', async () => {
    process.env.CF_ACCESS_SERVICE_EMAIL = 'e2e@portage.app';
    process.env.CF_ACCESS_SERVICE_COMMON_NAME = 'portage-e2e';
    resetEnv();
    loadEnv();
    try {
      // Wrong common_name: no identity, even though a service email is configured
      vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: null, commonName: 'some-other-token' });
      const rejected = await request(app)
        .get('/auth/session')
        .set('cf-access-jwt-assertion', 'cf-jwt');
      expect(rejected.status).toBe(401);
      expect(rejected.body.code).toBe('CF_REQUIRED');

      // Matching common_name maps to the service user
      vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: null, commonName: 'portage-e2e' });
      mockSelectReturns([{ ...existingUser, email: 'e2e@portage.app' }]);
      mockUpdateReturns();
      const accepted = await request(app)
        .get('/auth/session')
        .set('cf-access-jwt-assertion', 'cf-jwt');
      expect(accepted.status).toBe(200);
      expect(accepted.body.user.email).toBe('e2e@portage.app');
    } finally {
      delete process.env.CF_ACCESS_SERVICE_EMAIL;
      delete process.env.CF_ACCESS_SERVICE_COMMON_NAME;
      resetEnv();
      loadEnv();
    }
  });
});

function keyReq(overrides: Partial<{ assertion: string; ip: string }>): Request {
  return {
    headers: overrides.assertion ? { 'cf-access-jwt-assertion': overrides.assertion } : {},
    ip: overrides.ip,
  } as unknown as Request;
}

describe('sessionRateLimitKey', () => {
  it('gives different CF assertions different buckets and the same assertion the same bucket', () => {
    const a1 = sessionRateLimitKey(keyReq({ assertion: 'assertion-user-a', ip: '10.0.0.5' }));
    const a1again = sessionRateLimitKey(keyReq({ assertion: 'assertion-user-a', ip: '10.0.0.9' }));
    const b = sessionRateLimitKey(keyReq({ assertion: 'assertion-user-b', ip: '10.0.0.5' }));
    expect(a1).toBe(a1again);
    expect(a1).not.toBe(b);
  });

  it('keys by CF_ACCESS_DEV_EMAIL in development when no assertion is present', () => {
    process.env.NODE_ENV = 'development';
    process.env.CF_ACCESS_DEV_EMAIL = 'dev@portage.app';
    resetEnv();
    loadEnv();
    try {
      expect(sessionRateLimitKey(keyReq({ ip: '10.0.0.5' }))).toBe('dev:dev@portage.app');
    } finally {
      process.env.NODE_ENV = 'test';
      delete process.env.CF_ACCESS_DEV_EMAIL;
      resetEnv();
      loadEnv();
    }
  });

  it('falls back to the IP outside development, and to "unknown" when req.ip is undefined', () => {
    expect(sessionRateLimitKey(keyReq({ ip: '10.0.0.5' }))).toBe('10.0.0.5');
    expect(sessionRateLimitKey(keyReq({}))).toBe('unknown');
  });
});
