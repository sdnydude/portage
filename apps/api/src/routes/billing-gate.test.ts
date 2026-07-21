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

vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: {
    getCategorySuggestion: vi.fn().mockResolvedValue(null),
    searchComps: vi.fn().mockResolvedValue({ sold: [], active: [], stats: { soldMedian: null, soldAvg: null, activeMedian: null, activeAvg: null, sampleSize: 0 } }),
    getRequiredAspects: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../marketplace/reverb-adapter.js', () => ({
  ReverbAdapter: {
    searchComps: vi.fn().mockResolvedValue({ listings: [], stats: { median: null, avg: null, sampleSize: 0 } }),
  },
}));

vi.mock('../lib/vision.js', () => ({
  generateListingFields: vi.fn().mockResolvedValue({
    title: 'Test Item',
    description: 'A test item',
    condition: 'good',
    conditionDescription: 'Good condition',
    brand: 'TestBrand',
    model: 'TestModel',
    isMusicGear: false,
    aiConfidence: 0.9,
    ebay: null,
    reverb: null,
  }),
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
  token = createTestToken({ tier: 'free' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

function mockDbSequence(results: unknown[][], updateResult: unknown[] = [{ aiListingsThisMonth: 1 }]) {
  let callIndex = 0;
  vi.mocked(db.select).mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(() => {
          const result = results[callIndex] ?? [];
          callIndex++;
          return Promise.resolve(result);
        }),
      }),
    }),
  } as any));

  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(updateResult),
      }),
    }),
  } as any);
}

const { generateListingFields } = await import('../lib/vision.js');

describe('Billing gate in prepare-listing', () => {
  const baseUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    subscriptionTier: 'free',
    trialEndsAt: null,
    aiListingsThisMonth: 0,
    aiListingCredits: 0,
    scanCountResetAt: new Date(),
  };

  const baseItem = {
    id: 'item-1',
    userId: 'test-user-id',
    title: 'Test Guitar',
    brand: 'Fender',
    model: 'Strat',
    category: 'guitars',
    condition: 'good',
    conditionNotes: '',
    features: [],
    description: 'A guitar',
    photos: [{ url: 'https://example.com/photo.jpg' }],
  };

  it('allows request when under free tier limit', async () => {
    // Sequence: 1) item lookup, 2) seller profile, 3) billing user
    mockDbSequence([[baseItem], [], [baseUser]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
  });

  it('allows a beta-tester (null = unlimited limit) — live 429 repro 2026-07-21', async () => {
    // The reserve UPDATE's ceiling is SQL `aiListingsThisMonth < ${limit}`;
    // with limit null that comparison is NULL -> no row -> the gate read
    // "unlimited" as "zero" and 429'd ("AI listing limit reached (null/month)").
    // updateResult [] simulates that failed conditional reserve — an unlimited
    // tier must never depend on it.
    mockDbSequence(
      [[baseItem], [], [{ ...baseUser, subscriptionTier: 'beta-tester', aiListingsThisMonth: 999, aiListingCredits: 0 }]],
      [],
    );

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
  });

  it('returns 404 for missing item WITHOUT consuming a credit', async () => {
    mockDbSequence([[], [], [baseUser]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns 429 when free tier limit reached and no credits', async () => {
    mockDbSequence(
      [[baseItem], [], [{ ...baseUser, aiListingsThisMonth: 10 }]],
      [],
    );

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LIMIT_REACHED');
  });

  it('allows request using credits when over monthly limit', async () => {
    let updateCallCount = 0;
    vi.mocked(db.update).mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            updateCallCount++;
            if (updateCallCount === 1) return Promise.resolve([]); // monthly limit hit
            return Promise.resolve([{ aiListingCredits: 4 }]); // credit consumed
          }),
        }),
      }),
    } as any));
    mockDbSequence([[baseItem], [], [{ ...baseUser, aiListingsThisMonth: 10, aiListingCredits: 5 }]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
  });

  it('allows request for pro tier with higher limit', async () => {
    const proToken = createTestToken({ tier: 'pro' });
    mockDbSequence([[baseItem], [], [{ ...baseUser, subscriptionTier: 'pro', aiListingsThisMonth: 50 }]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${proToken}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
  });

  it('allows request during active trial (uses pro limits)', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockDbSequence([[baseItem], [], [{ ...baseUser, trialEndsAt: futureDate, aiListingsThisMonth: 50 }]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
  });

  it('rolls back credit on AI failure', async () => {
    vi.mocked(generateListingFields).mockRejectedValueOnce(new Error('AI service unavailable'));
    mockDbSequence([[baseItem], [], [baseUser]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(500);
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});
