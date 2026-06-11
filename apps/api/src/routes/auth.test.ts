import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { hashPassword } from '../lib/password.js';
import { hashToken, signAccessToken, signRefreshToken } from '../lib/jwt.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

function mockInsertReturns(rows: unknown[]) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
}

// The refresh_tokens session insert: .values(...) awaited directly, no .returning()
function mockSessionInsert() {
  const values = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.insert).mockReturnValueOnce({ values } as any);
  return values;
}

function mockUpdateReturns() {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as any);
}

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /auth/register', () => {
  it('returns 201 with token and user on success', async () => {
    mockSelectReturns([]);
    mockInsertReturns([{
      id: 'user-1',
      email: 'new@example.com',
      subscriptionTier: 'free',
      role: 'user',
      onboardingCompleted: false,
      createdAt: new Date('2026-01-01'),
    }]);
    mockUpdateReturns();

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@example.com', password: 'SecurePassword123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.id).toBe('user-1');
  });

  it('creates a per-session refresh_tokens row on registration', async () => {
    mockSelectReturns([]);
    // First insert: users row (values().returning()); second insert: session row (values() awaited)
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'user-1',
          email: 'new@example.com',
          subscriptionTier: 'free',
          role: 'user',
          onboardingCompleted: false,
          createdAt: new Date('2026-01-01'),
        }]),
      }),
    } as any);
    const sessionValues = mockSessionInsert();
    mockUpdateReturns();

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@example.com', password: 'SecurePassword123' });

    expect(res.status).toBe(201);
    expect(sessionValues).toHaveBeenCalledTimes(1);
    const inserted = sessionValues.mock.calls[0][0];
    expect(inserted.tokenHash).toBe(hashToken(res.body.refreshToken));
    expect(inserted.userId).toBe('user-1');
  });

  it('returns 409 for duplicate email', async () => {
    mockSelectReturns([{ id: 'existing-1' }]);

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'taken@example.com', password: 'SecurePassword123' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects password without uppercase letter', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'alllowercase123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects password shorter than 12 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'Short1' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns trialEndsAt in user response on registration', async () => {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockSelectReturns([]);
    mockInsertReturns([{
      id: 'user-trial',
      email: 'trial@example.com',
      subscriptionTier: 'free',
      role: 'user',
      onboardingCompleted: false,
      trialEndsAt: trialEnd,
      createdAt: new Date(),
    }]);
    mockUpdateReturns();

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'trial@example.com', password: 'SecurePassword123' });

    expect(res.status).toBe(201);
    expect(res.body.user.trialEndsAt).toBeDefined();
    const trialDate = new Date(res.body.user.trialEndsAt);
    const sixDaysOut = Date.now() + 6 * 24 * 60 * 60 * 1000;
    expect(trialDate.getTime()).toBeGreaterThan(sixDaysOut);
  });
});

describe('POST /auth/login', () => {
  const password = 'Correct-Password-123';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(password);
  });

  function mockUserRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash,
      displayName: 'Test User',
      subscriptionTier: 'pro',
      role: 'user',
      onboardingCompleted: true,
      aiScansThisMonth: 5,
      aiListingsThisMonth: 0,
      aiListingCredits: 0,
      bgRemovalsThisMonth: 2,
      trialEndsAt: null,
      createdAt: new Date('2026-01-01'),
      disabledAt: null,
      ...overrides,
    };
  }

  it('returns 200 with token and user on success', async () => {
    mockSelectReturns([mockUserRow()]);
    mockUpdateReturns();
    const sessionValues = mockSessionInsert();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('user@example.com');
    expect(res.body.user.subscriptionTier).toBe('pro');

    // Login creates a per-session refresh_tokens row for this device
    expect(sessionValues).toHaveBeenCalledTimes(1);
    const inserted = sessionValues.mock.calls[0][0];
    expect(inserted.tokenHash).toBe(hashToken(res.body.refreshToken));
    expect(inserted.userId).toBe('user-1');
    expect(inserted.expiresAt).toBeInstanceOf(Date);
  });

  it('stayLoggedIn:true creates a 365-day session instead of 30-day', async () => {
    mockSelectReturns([mockUserRow()]);
    mockUpdateReturns();
    const sessionValues = mockSessionInsert();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password, stayLoggedIn: true });

    expect(res.status).toBe(200);
    const inserted = sessionValues.mock.calls[0][0];
    const DAY_MS = 24 * 60 * 60 * 1000;
    const durationMs = inserted.expiresAt.getTime() - Date.now();
    expect(durationMs).toBeGreaterThan(364 * DAY_MS);
    expect(durationMs).toBeLessThanOrEqual(366 * DAY_MS);
  });

  it('returns billing fields in login response', async () => {
    const trialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    mockSelectReturns([mockUserRow({
      trialEndsAt: trialEnd,
      aiListingsThisMonth: 3,
      aiListingCredits: 7,
    })]);
    mockUpdateReturns();
    mockSessionInsert();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password });

    expect(res.status).toBe(200);
    expect(res.body.user.trialEndsAt).toBeDefined();
    expect(res.body.user.aiListingsThisMonth).toBe(3);
    expect(res.body.user.aiListingCredits).toBe(7);
  });

  it('returns 401 for wrong password', async () => {
    mockSelectReturns([mockUserRow()]);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for non-existent email', async () => {
    mockSelectReturns([]);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 403 for disabled account', async () => {
    mockSelectReturns([mockUserRow({ disabledAt: new Date('2026-05-01') })]);
    mockUpdateReturns();

    const freshApp = createApp();
    const res = await request(freshApp)
      .post('/auth/login')
      .send({ email: 'user@example.com', password });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

});

describe('POST /auth/logout', () => {
  const payload = { sub: 'user-1', email: 'user@example.com', tier: 'pro' as const, role: 'user' as const };

  it('deletes the session row for the provided refresh token', async () => {
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereSpy } as any);
    mockUpdateReturns();

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.loggedOut).toBe(true);
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });
});
