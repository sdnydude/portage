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
  resolveEbayCategoryCondition: vi.fn().mockReturnValue({}),
  EbayAdapter: {
    getCategorySuggestion: vi.fn().mockResolvedValue(null),
    getValidConditions: vi.fn().mockResolvedValue([]),
    searchComps: vi.fn().mockResolvedValue({
      sold: [
        { price: 100, condition: 'GOOD' },
        { price: 200, condition: 'GOOD' },
        { price: 300, condition: 'GOOD' },
        { price: 400, condition: 'GOOD' },
      ],
      active: [],
      stats: { soldMedian: 250, soldAvg: 250, activeMedian: null, activeAvg: null, sampleSize: 4 },
    }),
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

describe('Seller-tuned pricing percentile in prepare-listing', () => {
  it('uses the seller profile suggestPercentile for the suggested price', async () => {
    // Sequence: 1) item lookup, 2) seller profile (tuned to p75), 3) billing user
    // Sold pool [100,200,300,400] R-7 p75 -> 325; undercut NOT applied off 50.
    mockDbSequence([[baseItem], [{ id: 'sp-1', pricingSuggestPercentile: 75, pricingFloorPercentile: 25 }], [baseUser]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
    expect(res.body.pricing.suggested).toBe(325);
  });

  it('falls back to the default p50 with undercut when no profile row exists', async () => {
    // p50 of [100,200,300,400] -> 250; * 0.97 = 242.5
    mockDbSequence([[baseItem], [], [baseUser]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
    expect(res.body.pricing.suggested).toBe(242.5);
  });

  it('attaches the Best-Offer auto-accept floor to prepared eBay fields when the seller opted in', async () => {
    const { generateListingFields } = await import('../lib/vision.js');
    vi.mocked(generateListingFields).mockResolvedValueOnce({
      title: 'Test Item',
      description: 'A test item',
      condition: 'good',
      conditionDescription: 'Good condition',
      brand: 'TestBrand',
      model: 'TestModel',
      isMusicGear: false,
      aiConfidence: 0.9,
      ebay: { title: 'Test Item', categoryId: '15032', categoryName: 'Guitars' },
      reverb: null,
    } as any);
    // Floor = R-7 p25 of the SAME sold pool -> 175 (< suggested 242.5, kept).
    mockDbSequence([
      [baseItem],
      [{ id: 'sp-1', pricingSuggestPercentile: 50, pricingFloorPercentile: 25, bestOfferAutoAcceptEnabled: true }],
      [baseUser],
    ]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
    expect(res.body.ebay.bestOfferAutoAcceptPrice).toBe(175);
  });
});
