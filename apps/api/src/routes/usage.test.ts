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

describe('GET /usage', () => {
  it('reports used/limit per meter for a free-tier user', async () => {
    mockSelectOnce([{
      aiScansThisMonth: 5, aiListingsThisMonth: 2, aiListingCredits: 0,
      bgRemovalsThisMonth: 1, subscriptionTier: 'free', trialEndsAt: null,
    }]);

    const res = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('free');
    expect(res.body.aiScans.used).toBe(5);
    expect(res.body.aiScans.limit).toBeGreaterThan(0); // free tier is metered
    expect(res.body.aiListings.credits).toBe(0);
  });

  it('collapses an EXPIRED trial back to the free tier limits', async () => {
    mockSelectOnce([{
      aiScansThisMonth: 0, aiListingsThisMonth: 0, aiListingCredits: 0,
      bgRemovalsThisMonth: 0, subscriptionTier: 'trial', trialEndsAt: new Date('2026-01-01T00:00:00Z'),
    }]);

    const res = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // trialEndsAt in the past → effective tier must NOT stay 'trial'
    expect(res.body.tier).toBe('free');
  });

  it('404s when the user row is missing', async () => {
    mockSelectOnce([]);

    const res = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/usage');
    expect(res.status).toBe(401);
  });
});

describe('GET /usage — per-user limit overrides', () => {
  it('an admin-set override beats the tier limit (free user granted 100 scans)', async () => {
    mockSelectOnce([{
      aiScansThisMonth: 30, aiListingsThisMonth: 0, aiListingCredits: 0,
      bgRemovalsThisMonth: 0, subscriptionTier: 'free', trialEndsAt: null,
      limitOverrides: { aiScansPerMonth: 100 },
    }]);

    const res = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.aiScans.limit).toBe(100);
    // Meters without an override keep the tier limit.
    expect(res.body.bgRemovals.limit).not.toBe(100);
  });
});

describe('POST /usage/bg-removal', () => {
  it('allows while under the tier limit, with the remaining count', async () => {
    mockSelectOnce([{
      subscriptionTier: 'free', trialEndsAt: null, bgRemovalsThisMonth: 2,
    }]);

    const res = await request(app)
      .post('/usage/bg-removal')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body.used).toBe(2);
    expect(res.body.remaining).toBe(res.body.limit - 2);
  });

  it('denies at the limit — remaining 0, allowed false', async () => {
    // Discover the free-tier limit from the endpoint itself, then pin the denial.
    mockSelectOnce([{ subscriptionTier: 'free', trialEndsAt: null, bgRemovalsThisMonth: 0 }]);
    const probe = await request(app)
      .post('/usage/bg-removal')
      .set('Authorization', `Bearer ${authToken}`);
    const limit = probe.body.limit as number;

    mockSelectOnce([{ subscriptionTier: 'free', trialEndsAt: null, bgRemovalsThisMonth: limit }]);
    const res = await request(app)
      .post('/usage/bg-removal')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
    expect(res.body.remaining).toBe(0);
  });

  it('treats a null limit (unlimited tier) as always allowed', async () => {
    mockSelectOnce([{
      subscriptionTier: 'beta-tester', trialEndsAt: null, bgRemovalsThisMonth: 9999,
    }]);

    const res = await request(app)
      .post('/usage/bg-removal')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    if (res.body.limit === null) {
      expect(res.body.allowed).toBe(true);
      expect(res.body.remaining).toBeNull();
    } else {
      // If beta-tester ever becomes metered this pins the arithmetic instead.
      expect(res.body.allowed).toBe(res.body.used < res.body.limit);
    }
  });
});
