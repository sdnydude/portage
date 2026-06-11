import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { signRefreshToken, signAccessToken, hashToken, type JwtPayload } from '../lib/jwt.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Queue successive db.select chains — refresh does two selects:
// 1) refresh_tokens row by tokenHash, 2) users row by session.userId
function queueSelects(...rowSets: unknown[][]) {
  for (const rows of rowSets) {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    } as any);
  }
}

function mockInsertReturns() {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as any);
}

function mockDeleteReturns() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as any);
}

const testPayload: JwtPayload = {
  sub: 'user-1',
  email: 'user@example.com',
  tier: 'pro',
  role: 'user',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function mockSessionRow(refreshToken: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    tokenHash: hashToken(refreshToken),
    createdAt: new Date(Date.now() - 5 * DAY_MS),
    expiresAt: new Date(Date.now() + 25 * DAY_MS),
    lastUsedAt: null,
    ...overrides,
  };
}

function mockUserRow(overrides: Record<string, unknown> = {}) {
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
    queueSelects([mockSessionRow(refreshToken)], [mockUserRow()]);
    mockInsertReturns();
    mockDeleteReturns();

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('user@example.com');
    expect(res.body.user.id).toBe('user-1');
  });

  it('rotates the session row: deletes the old token row and inserts the new hash', async () => {
    const refreshToken = signRefreshToken(testPayload);
    queueSelects([mockSessionRow(refreshToken)], [mockUserRow()]);
    mockInsertReturns();
    mockDeleteReturns();

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(1);
    const valuesCall = vi.mocked(db.insert).mock.results[0]?.value;
    const inserted = valuesCall.values.mock.calls[0][0];
    expect(inserted.tokenHash).toBe(hashToken(res.body.refreshToken));
    expect(inserted.userId).toBe('user-1');
    expect(inserted.expiresAt).toBeInstanceOf(Date);
  });

  it('preserves the session duration on rotation (365d stay-logged-in session stays 365d)', async () => {
    const refreshToken = signRefreshToken(testPayload, '365d');
    const YEAR_MS = 365 * DAY_MS;
    queueSelects(
      [mockSessionRow(refreshToken, {
        createdAt: new Date(Date.now() - 10 * DAY_MS),
        expiresAt: new Date(Date.now() + 355 * DAY_MS),
      })],
      [mockUserRow()],
    );
    mockInsertReturns();
    mockDeleteReturns();

    await request(app).post('/auth/refresh').send({ refreshToken });

    const valuesCall = vi.mocked(db.insert).mock.results[0]?.value;
    const inserted = valuesCall.values.mock.calls[0][0];
    const newDurationMs = inserted.expiresAt.getTime() - Date.now();
    expect(newDurationMs).toBeGreaterThan(YEAR_MS - 60_000);
    expect(newDurationMs).toBeLessThanOrEqual(YEAR_MS + 60_000);
  });

  it('returns 401 for expired refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'expired.token.value' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 401 and deletes the row when the session row is past its expiry', async () => {
    const refreshToken = signRefreshToken(testPayload);
    queueSelects([mockSessionRow(refreshToken, {
      createdAt: new Date(Date.now() - 31 * DAY_MS),
      expiresAt: new Date(Date.now() - DAY_MS),
    })]);
    mockDeleteReturns();

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when no session row exists for the token (revoked)', async () => {
    const refreshToken = signRefreshToken(testPayload);
    queueSelects([]);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 401 when user not found', async () => {
    const refreshToken = signRefreshToken(testPayload);
    queueSelects([mockSessionRow(refreshToken)], []);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 403 for disabled account', async () => {
    const refreshToken = signRefreshToken(testPayload);
    queueSelects([mockSessionRow(refreshToken)], [mockUserRow({ disabledAt: new Date('2026-05-01') })]);

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
