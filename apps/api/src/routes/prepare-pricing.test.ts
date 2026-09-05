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

const { mockReverbSearchCategories } = vi.hoisted(() => ({
  mockReverbSearchCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock('../marketplace/reverb-adapter.js', () => {
  const ReverbAdapter = Object.assign(
    vi.fn(function () { return ({ searchCategories: mockReverbSearchCategories }); }),
    {
      searchComps: vi.fn().mockResolvedValue({ listings: [], stats: { median: null, avg: null, sampleSize: 0 } }),
      referenceToken: vi.fn().mockResolvedValue(undefined),
      getConditions: vi.fn().mockResolvedValue([]),
      getFlatCategories: vi.fn().mockResolvedValue([
        { uuid: 'u-dist', fullName: 'Effects and Pedals / Distortion' },
        { uuid: 'u-mics', fullName: 'Pro Audio / Microphones' },
      ]),
    },
  );
  return { ReverbAdapter };
});

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
  default: vi.fn(function () { return ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  }); }),
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

  it('does NOT attach a Best-Offer floor when the seller has not opted in', async () => {
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
    // Same valid floor pool as the opt-in test, but bestOfferAutoAcceptEnabled
    // is false — the gate (not the floor math) must block attachment.
    mockDbSequence([
      [baseItem],
      [{ id: 'sp-1', pricingSuggestPercentile: 50, pricingFloorPercentile: 25, bestOfferAutoAcceptEnabled: false }],
      [baseUser],
    ]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
    expect(res.body.pricing.bestOfferFloor).toBe(175);
    expect(res.body.ebay.bestOfferAutoAcceptPrice).toBeUndefined();
  });

  it('warns when the seller opted into Best Offer but thin comps suppressed the floor', async () => {
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
    const { EbayAdapter } = await import('../marketplace/ebay-adapter.js');
    // n=2 pool: engine suppresses the floor (n<3) — opted-in seller must be told.
    vi.mocked(EbayAdapter.searchComps).mockResolvedValueOnce({
      sold: [
        { price: 100, condition: 'GOOD' },
        { price: 200, condition: 'GOOD' },
      ],
      active: [],
      stats: { soldMedian: 150, soldAvg: 150, activeMedian: null, activeAvg: null, sampleSize: 2 },
    } as any);
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
    expect(res.body.ebay.bestOfferAutoAcceptPrice).toBeUndefined();
    expect(res.body.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/best offer/i)]),
    );
  });

  it('carries the seller default footer for display-only preview', async () => {
    mockDbSequence([
      [baseItem],
      [{ id: 'sp-1', pricingSuggestPercentile: 50, pricingFloorPercentile: 25, defaultListingFooter: 'Ships fast.' }],
      [baseUser],
    ]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['ebay'] });

    expect(res.status).toBe(200);
    expect(res.body.listingFooter).toBe('Ships fast.');
  });
});

describe('Reverb uuid validation in prepare-listing', () => {
  it('replaces hallucinated AI reverb uuids with values validated against the live lists', async () => {
    const { generateListingFields } = await import('../lib/vision.js');
    vi.mocked(generateListingFields).mockResolvedValueOnce({
      title: 'ProCo RAT 2',
      description: 'A pedal',
      condition: 'good',
      conditionDescription: 'Light wear',
      brand: 'ProCo',
      model: 'RAT 2',
      isMusicGear: true,
      aiConfidence: 0.9,
      ebay: null,
      reverb: {
        make: 'ProCo', model: 'RAT 2', title: 'ProCo RAT 2',
        categoryUuid: 'made-up-cat-uuid', categoryName: 'Effects and Pedals / Distortion',
        conditionUuid: 'made-up-cond-uuid', conditionName: 'Excellent',
        year: null, finish: null, description: 'A pedal',
      },
    } as any);
    const { ReverbAdapter } = await import('../marketplace/reverb-adapter.js');
    vi.mocked((ReverbAdapter as any).getConditions).mockResolvedValueOnce([
      { uuid: 'real-cond-excellent', displayName: 'Excellent' },
    ]);
    mockReverbSearchCategories.mockResolvedValueOnce([
      { id: 'real-cat-distortion', name: 'Effects and Pedals / Distortion', path: [], isLeaf: true },
    ]);
    mockDbSequence([[baseItem], [], [baseUser]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['reverb'] });

    expect(res.status).toBe(200);
    expect(res.body.reverb).toMatchObject({
      categoryUuid: 'real-cat-distortion',
      conditionUuid: 'real-cond-excellent',
    });
  });
});

describe('Reverb flat-category list injection', () => {
  it('passes the real Reverb category names to the AI when reverb is targeted', async () => {
    const { generateListingFields } = await import('../lib/vision.js');
    mockDbSequence([[baseItem], [], [baseUser]]);

    const res = await request(app)
      .post('/items/item-1/prepare-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMarketplaces: ['reverb'] });

    expect(res.status).toBe(200);
    const input = vi.mocked(generateListingFields).mock.calls[0][0] as any;
    expect(input.reverbCategories).toEqual([
      'Effects and Pedals / Distortion',
      'Pro Audio / Microphones',
    ]);
  });
});
