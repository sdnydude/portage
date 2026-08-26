import request from 'supertest';
import { createApp } from '../app.js';
import { loadEnv } from '../lib/env.js';
import { db } from '../db/index.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../marketplace/token-manager.js', () => ({
  getEbayAccessToken: vi.fn(),
}));

// db.select() is called once per table; queue a result per call in order.
function mockSelectOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function mockUpdateReturns(rows: unknown[]) {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  loadEnv();
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEbayAccessToken).mockResolvedValue('tok');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /seller-profile auto-create race (P7 6adfadb4)', () => {
  it('re-selects and returns the existing row when a concurrent request already created the profile (unique violation, not a 500)', async () => {
    const existing = { id: 'sp-1', userId: 'test-user-id' };
    mockSelectOnce([]); // first read: no profile yet
    // Concurrent request won the insert — ours hits the userId unique index.
    // Drizzle wraps driver errors: the pg code lives at err.cause.code.
    const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
      cause: { code: '23505' },
    });
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        returning: vi.fn().mockRejectedValue(uniqueViolation),
      }),
    } as any);
    mockSelectOnce([existing]); // re-select finds the winner's row

    const res = await request(app)
      .get('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual(existing);
  });
});

describe('PATCH /seller-profile', () => {
  it('accepts ebayPublishMode in the update schema', async () => {
    mockSelectOnce([{ id: 'sp-1' }]);
    mockUpdateReturns([{ id: 'sp-1', ebayPublishMode: 'draft' }]);

    const res = await request(app)
      .patch('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ebayPublishMode: 'draft' });

    expect(res.status).toBe(200);
  });

  it('accepts a Reverb shipping profile reference without per-listing rates', async () => {
    mockSelectOnce([{ id: 'sp-1' }]);
    mockUpdateReturns([{ id: 'sp-1', reverbDefaultShipping: { shippingProfileId: '456', local: false } }]);

    const res = await request(app)
      .patch('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reverbDefaultShipping: { shippingProfileId: '456', local: false } });

    expect(res.status).toBe(200);
  });

  it('rejects floor >= suggest percentile sent together', async () => {
    mockSelectOnce([{ id: 'sp-1', pricingSuggestPercentile: 50, pricingFloorPercentile: 25 }]);

    const res = await request(app)
      .patch('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ pricingSuggestPercentile: 50, pricingFloorPercentile: 60 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRICING_FLOOR_INVALID');
  });

  it('merges with the stored row when only the floor is sent (floor >= stored suggest rejected)', async () => {
    mockSelectOnce([{ id: 'sp-1', pricingSuggestPercentile: 30, pricingFloorPercentile: 25 }]);

    const res = await request(app)
      .patch('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ pricingFloorPercentile: 40 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRICING_FLOOR_INVALID');
  });

  it('merges the OTHER direction too — suggest-only sent below the stored floor rejected', async () => {
    mockSelectOnce([{ id: 'sp-1', pricingSuggestPercentile: 50, pricingFloorPercentile: 25 }]);

    const res = await request(app)
      .patch('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ pricingSuggestPercentile: 20 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRICING_FLOOR_INVALID');
  });

  it('accepts bestOfferAutoAcceptEnabled and defaultListingFooter', async () => {
    mockSelectOnce([{ id: 'sp-1' }]);
    mockUpdateReturns([{ id: 'sp-1', bestOfferAutoAcceptEnabled: true, defaultListingFooter: 'Ships fast from a smoke-free studio.' }]);

    const res = await request(app)
      .patch('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bestOfferAutoAcceptEnabled: true, defaultListingFooter: 'Ships fast from a smoke-free studio.' });

    expect(res.status).toBe(200);
    expect(res.body.profile.bestOfferAutoAcceptEnabled).toBe(true);
  });

  it('accepts gtcAutoEnd alone', async () => {
    mockSelectOnce([{ id: 'sp-1' }]);
    mockUpdateReturns([{ id: 'sp-1', gtcAutoEnd: true }]);

    const res = await request(app)
      .patch('/seller-profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ gtcAutoEnd: true });

    expect(res.status).toBe(200);
    expect(res.body.profile.gtcAutoEnd).toBe(true);
  });
});

describe('Business Policies endpoints — REMOVED under inline terms', () => {
  // The auto-setup short-circuit existed only to feed the FE "Set up eBay
  // Selling" button a clear message; the button is gone, so both endpoints are.
  it('POST /seller-profile/ebay/auto-setup is gone (404), and makes no eBay calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /seller-profile/ebay-policies is gone (404), and makes no eBay calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .get('/seller-profile/ebay-policies')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
