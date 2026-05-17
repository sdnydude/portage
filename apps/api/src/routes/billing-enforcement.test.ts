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

vi.mock('../lib/storage.js', () => ({
  uploadImage: vi.fn().mockResolvedValue({ key: 'items/test/nobg.png', url: 'https://r2.example.com/nobg.png' }),
  deleteImage: vi.fn(),
  getImage: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

let app: ReturnType<typeof createApp>;
let freeToken: string;
let proToken: string;

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
  process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_test';
  process.env.STRIPE_PRICE_ANNUAL = 'price_annual_test';
  process.env.STRIPE_PRICE_CREDITS = 'price_credits_test';
  process.env.REMBG_URL = 'http://localhost:7000';
  process.env.R2_PUBLIC_URL = 'https://r2.example.com';
  app = createApp();
  freeToken = createTestToken({ tier: 'free' });
  proToken = createTestToken({ tier: 'pro' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Marketplace count enforcement', () => {
  const freeUser = {
    subscriptionTier: 'free',
    trialEndsAt: null,
  };

  const proUser = {
    subscriptionTier: 'pro',
    trialEndsAt: null,
  };

  it('rejects new marketplace connection when free tier limit reached', async () => {
    // Mock: no existing eBay connection, user is free, count=1 (at limit)
    let selectCall = 0;
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 1) {
            // Check existing eBay account
            return { limit: vi.fn().mockResolvedValue([]) };
          }
          if (selectCall === 2) {
            // User tier lookup
            return { limit: vi.fn().mockResolvedValue([freeUser]) };
          }
          // Count of marketplace accounts
          return Promise.resolve([{ count: 1 }]);
        }),
      }),
    }) as any);

    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MARKETPLACE_LIMIT_REACHED');
  });

  it('allows reconnection of existing marketplace regardless of count', async () => {
    // Mock: eBay already connected → skip limit check
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing-ebay' }]),
        }),
      }),
    }) as any);

    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${freeToken}`);

    // Should proceed (503 = eBay not configured in test env, not 403)
    expect(res.status).not.toBe(403);
  });

  it('allows pro user to connect unlimited marketplaces', async () => {
    let selectCall = 0;
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 1) {
            return { limit: vi.fn().mockResolvedValue([]) };
          }
          if (selectCall === 2) {
            return { limit: vi.fn().mockResolvedValue([proUser]) };
          }
          return Promise.resolve([{ count: 5 }]);
        }),
      }),
    }) as any);

    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${proToken}`);

    // Should NOT be 403 (will be 503 due to missing eBay config in test)
    expect(res.status).not.toBe(403);
  });
});

describe('Background removal billing gate', () => {
  const freeUser = {
    subscriptionTier: 'free',
    trialEndsAt: null,
    bgRemovalsThisMonth: 5,
    scanCountResetAt: new Date(),
  };

  it('POST /usage/bg-removal returns read-only status (no deduction)', async () => {
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ ...freeUser, bgRemovalsThisMonth: 3 }]),
        }),
      }),
    }) as any);

    const res = await request(app)
      .post('/usage/bg-removal')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      allowed: true,
      remaining: 2,
      limit: 5,
      used: 3,
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('POST /usage/bg-removal returns allowed=false when at limit', async () => {
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([freeUser]),
        }),
      }),
    }) as any);

    const res = await request(app)
      .post('/usage/bg-removal')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
    expect(res.body.remaining).toBe(0);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('POST /usage/bg-removal returns unlimited for pro user', async () => {
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            subscriptionTier: 'pro',
            trialEndsAt: null,
            bgRemovalsThisMonth: 50,
          }]),
        }),
      }),
    }) as any);

    const res = await request(app)
      .post('/usage/bg-removal')
      .set('Authorization', `Bearer ${proToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body.remaining).toBeNull();
    expect(res.body.limit).toBeNull();
  });
});
