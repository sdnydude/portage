import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
  process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_test';
  process.env.STRIPE_PRICE_ANNUAL = 'price_annual_test';
  process.env.STRIPE_PRICE_CREDITS = 'price_credits_test';
  app = createApp();
  token = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
});

function mockUserRow(overrides: Record<string, unknown> = {}) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{
          subscriptionTier: 'free',
          trialEndsAt: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          aiScansThisMonth: 3,
          aiListingsThisMonth: 2,
          aiListingCredits: 0,
          bgRemovalsThisMonth: 1,
          scanCountResetAt: new Date(),
          ...overrides,
        }]),
      }),
    }),
  } as any);
}

describe('GET /billing/status', () => {
  it('returns free tier status with limits and usage', async () => {
    mockUserRow();

    const res = await request(app)
      .get('/billing/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.effectiveTier).toBe('free');
    expect(res.body.trial).toBeNull();
    expect(res.body.usage.aiListings).toEqual({ used: 2, limit: 10, credits: 0 });
    expect(res.body.usage.bgRemovals).toEqual({ used: 1, limit: 5 });
    expect(res.body.usage.porterExchanges).toEqual({ limit: 5 });
    expect(res.body.usage.marketplaces).toEqual({ limit: 1 });
    expect(res.body.subscription).toBeNull();
  });

  it('returns pro tier with unlimited fields as null', async () => {
    mockUserRow({
      subscriptionTier: 'pro',
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_monthly_test',
      aiListingsThisMonth: 50,
      bgRemovalsThisMonth: 30,
    });

    const res = await request(app)
      .get('/billing/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.effectiveTier).toBe('pro');
    expect(res.body.usage.aiListings).toEqual({ used: 50, limit: 75, credits: 0 });
    expect(res.body.usage.bgRemovals).toEqual({ used: 30, limit: null });
    expect(res.body.usage.porterExchanges).toEqual({ limit: 500 });
    expect(res.body.usage.marketplaces).toEqual({ limit: null });
    expect(res.body.subscription).toEqual({
      id: 'sub_123',
      plan: 'monthly',
    });
  });

  it('returns active trial info when trial not expired', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mockUserRow({ trialEndsAt: futureDate });

    const res = await request(app)
      .get('/billing/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.effectiveTier).toBe('pro');
    expect(res.body.trial).toEqual({
      active: true,
      endsAt: futureDate.toISOString(),
    });
  });

  it('returns expired trial info', async () => {
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    mockUserRow({ trialEndsAt: pastDate });

    const res = await request(app)
      .get('/billing/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.effectiveTier).toBe('free');
    expect(res.body.trial).toEqual({
      active: false,
      endsAt: pastDate.toISOString(),
    });
  });

  it('identifies annual plan from price ID', async () => {
    mockUserRow({
      subscriptionTier: 'pro',
      stripeSubscriptionId: 'sub_456',
      stripePriceId: 'price_annual_test',
    });

    const res = await request(app)
      .get('/billing/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.subscription).toEqual({
      id: 'sub_456',
      plan: 'annual',
    });
  });

  it('requires auth', async () => {
    const res = await request(app).get('/billing/status');
    expect(res.status).toBe(401);
  });
});
