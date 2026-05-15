import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { signRefreshToken, signAccessToken, hashToken, type JwtPayload } from '../lib/jwt.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
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

const testPayload: JwtPayload = {
  sub: 'user-1',
  email: 'user@example.com',
  tier: 'pro',
  role: 'user',
};

function mockUserRow(refreshToken: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Test User',
    subscriptionTier: 'pro',
    role: 'user',
    onboardingCompleted: true,
    aiScansThisMonth: 5,
    bgRemovalsThisMonth: 2,
    createdAt: new Date('2026-01-01'),
    disabledAt: null,
    refreshTokenHash: hashToken(refreshToken),
    ...overrides,
  };
}

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /auth/refresh', () => {
  it('returns new tokens on valid refresh', async () => {
    const refreshToken = signRefreshToken(testPayload);
    mockSelectReturns([mockUserRow(refreshToken)]);
    mockUpdateReturns();

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('user@example.com');
    expect(res.body.user.id).toBe('user-1');
  });

  it('rotates the refresh token hash in DB to match the new token', async () => {
    const refreshToken = signRefreshToken(testPayload);
    mockSelectReturns([mockUserRow(refreshToken)]);
    mockUpdateReturns();

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(db.update).toHaveBeenCalledTimes(1);
    const setCall = vi.mocked(db.update).mock.results[0]?.value;
    const writtenHash = setCall.set.mock.calls[0][0].refreshTokenHash;
    expect(writtenHash).toBe(hashToken(res.body.refreshToken));
  });

  it('returns 401 for expired refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'expired.token.value' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 401 when refresh token hash mismatches (revoked token)', async () => {
    const refreshToken = signRefreshToken(testPayload);
    mockSelectReturns([{
      ...mockUserRow(refreshToken),
      refreshTokenHash: 'stale-hash-from-a-previous-token-rotation',
    }]);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 401 when user not found', async () => {
    const refreshToken = signRefreshToken(testPayload);
    mockSelectReturns([]);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 403 for disabled account', async () => {
    const refreshToken = signRefreshToken(testPayload);
    mockSelectReturns([mockUserRow(refreshToken, { disabledAt: new Date('2026-05-01') })]);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('rejects an access token used as refresh token', async () => {
    const accessToken = signAccessToken(testPayload);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: accessToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 400 for missing refreshToken field', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
