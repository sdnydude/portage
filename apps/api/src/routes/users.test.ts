import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

const USER_ROW = {
  email: 'seller@example.com',
  displayName: 'Seller',
  subscriptionTier: 'free',
  address: null,
  notificationPreferences: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function mockSelectOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /users/me', () => {
  it('returns the profile projection (no password/token fields)', async () => {
    mockSelectOnce([USER_ROW]);

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('seller@example.com');
    expect(res.body.displayName).toBe('Seller');
    // Projection must never leak credentials or internal columns.
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.id).toBeUndefined();
  });

  it('404s when the JWT subject has no user row (deleted account)', async () => {
    mockSelectOnce([]);

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /users/me', () => {
  it('updates displayName and returns the fresh projection', async () => {
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...USER_ROW, displayName: 'New Name' }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('New Name');
    expect(updateSet).toHaveBeenCalledWith({ displayName: 'New Name' });
  });

  it('rejects an empty body — at least one field required', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('rejects unknown notification preference keys via the schema', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ notificationPreferences: { sale: 'yes-please' } });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /users/me/onboarding', () => {
  it('marks onboarding completed (literal true only)', async () => {
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

    const res = await request(app)
      .patch('/users/me/onboarding')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ onboardingCompleted: true });
    expect(updateSet).toHaveBeenCalledWith({ onboardingCompleted: true });
  });

  it('rejects completed:false — onboarding cannot be un-done through this route', async () => {
    const res = await request(app)
      .patch('/users/me/onboarding')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ completed: false });

    expect(res.status).toBe(400);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });
});

describe('GET /users/me/marketplace-accounts', () => {
  it('lists connections WITHOUT the encrypted token columns', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 'acct-1', marketplace: 'ebay', marketplaceUserId: 'seller1',
          tokenExpiresAt: new Date('2026-08-01T00:00:00Z'), createdAt: new Date('2026-06-01T00:00:00Z'),
        }]),
      }),
    } as any);

    const res = await request(app)
      .get('/users/me/marketplace-accounts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].marketplace).toBe('ebay');
    expect(res.body.accounts[0].accessTokenEncrypted).toBeUndefined();
    expect(res.body.accounts[0].refreshTokenEncrypted).toBeUndefined();
  });
});
