import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestToken } from '../../test/helpers.js';
import { resetEnv, loadEnv } from '../../lib/env.js';
import { db } from '../../db/index.js';
import { EbayAdapter } from '../../marketplace/ebay-adapter.js';
import * as metrics from '../../lib/metrics.js';
import { EBAY_USER_AGENT } from '../../marketplace/ebay-constants.js';

vi.mock('../../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../lib/storage.js', () => ({
  uploadImage: vi.fn(),
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
let token: string;

beforeAll(() => {
  process.env.EBAY_CLIENT_ID = 'sandbox-client-id';
  process.env.EBAY_CLIENT_SECRET = 'sandbox-secret';
  process.env.EBAY_PROD_CLIENT_ID = 'prod-client-id';
  process.env.EBAY_PROD_CLIENT_SECRET = 'prod-secret';
  process.env.EBAY_REDIRECT_URI = 'Test-RuName-prod';
  process.env.EBAY_SANDBOX = 'false';
  resetEnv();
  loadEnv();
  app = createApp();
  token = createTestToken({ tier: 'pro' });
});

beforeEach(() => {
  vi.clearAllMocks();
  // Existing eBay account → skips the billing limit check, proceeds to build authUrl
  vi.mocked(db.select).mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id: 'existing-ebay' }]),
      }),
    }),
  }) as any);
});

describe('GET /marketplace/ebay/connect credential selection', () => {
  it('builds the consent URL with the production client_id when EBAY_SANDBOX is false', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.authUrl).toContain('client_id=prod-client-id');
    expect(res.body.authUrl).toContain('auth.ebay.com');
  });

  it('forces re-login with prompt=login so users can switch eBay accounts on reconnect', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.authUrl).toContain('prompt=login');
  });

  it('requests the sell.analytics.readonly scope for the listing-optimizer traffic report', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(decodeURIComponent(res.body.authUrl)).toContain('sell.analytics.readonly');
  });
});

describe('POST /marketplace/ebay/callback identity capture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function getValidState(): Promise<string> {
    const connectRes = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${token}`);
    return new URL(connectRes.body.authUrl).searchParams.get('state')!;
  }

  it('stores the eBay userId from the Identity API on a successful callback', async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

    const state = await getValidState();

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: 'ebay-user-123', username: 'cooluser' }) }),
    );

    const res = await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ marketplaceUserId: 'ebay-user-123' }));
  });

  it('exchanges the auth code using the production credentials when EBAY_SANDBOX is false', async () => {
    vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as any);

    const state = await getValidState();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: 'u' }) });
    vi.stubGlobal('fetch', fetchMock);

    await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    const expectedAuth = `Basic ${Buffer.from('prod-client-id:prod-secret').toString('base64')}`;
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toContain('https://api.ebay.com/identity/v1/oauth2/token');
    expect(tokenInit.headers).toMatchObject({ Authorization: expectedAuth });
  });

  it('sends a descriptive User-Agent on the auth-code exchange (anonymous reconnect is an ATO signal)', async () => {
    vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as any);

    const state = await getValidState();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: 'u' }) });
    vi.stubGlobal('fetch', fetchMock);

    await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    const [, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((tokenInit.headers as Record<string, string>)['User-Agent']).toBe(EBAY_USER_AGENT);
  });

  it('still connects when the Identity fetch THROWS (network error), leaving marketplaceUserId null (P7 d56aff62)', async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

    const state = await getValidState();

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
        .mockRejectedValueOnce(new TypeError('fetch failed: getaddrinfo ENOTFOUND apiz.ebay.com')),
    );

    const res = await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ marketplaceUserId: null }));
  });

  it('still connects when the Identity API fails, leaving marketplaceUserId null', async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

    const state = await getValidState();

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'identity error' }),
    );

    const res = await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ marketplaceUserId: null }));
  });
});

describe('GET /marketplace/ebay/category-suggestion', () => {
  it('returns the suggested category bundled with its valid condition IDs', async () => {
    vi.spyOn(EbayAdapter, 'getCategorySuggestion').mockResolvedValue({ categoryId: '619', categoryName: 'Guitar Amplifiers', rootCategoryId: null, rootCategoryName: null });
    vi.spyOn(EbayAdapter, 'getValidConditions').mockResolvedValue(['1000', '3000']);

    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'fender deluxe reverb amp' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(EbayAdapter.getCategorySuggestion).toHaveBeenCalledWith('fender deluxe reverb amp');
    expect(EbayAdapter.getValidConditions).toHaveBeenCalledWith('619');
    expect(res.body).toEqual({
      suggestion: { categoryId: '619', categoryName: 'Guitar Amplifiers', rootCategoryId: null, rootCategoryName: null, conditionIds: ['1000', '3000'] },
      mismatch: false, // no visionCategory param sent — guard fails open
    });
  });

  it('flags mismatch:true when visionCategory is implausible for the suggestion root (Baseball Jackets incident)', async () => {
    vi.spyOn(EbayAdapter, 'getCategorySuggestion').mockResolvedValue({
      categoryId: '181335', categoryName: 'Baseball Jackets',
      rootCategoryId: '11450', rootCategoryName: 'Clothing, Shoes & Accessories',
    });
    vi.spyOn(EbayAdapter, 'getValidConditions').mockResolvedValue([]);

    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'fiber optic audio cable', visionCategory: 'electronics' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mismatch).toBe(true);
    expect(res.body.suggestion.categoryId).toBe('181335');
  });

  it('accepts an over-50-char visionCategory (AI drift) instead of 400ing — truncated, guard still works', async () => {
    vi.spyOn(EbayAdapter, 'getCategorySuggestion').mockResolvedValue({
      categoryId: '181335', categoryName: 'Baseball Jackets',
      rootCategoryId: '11450', rootCategoryName: 'Clothing, Shoes & Accessories',
    });
    vi.spyOn(EbayAdapter, 'getValidConditions').mockResolvedValue([]);

    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'fiber optic audio cable', visionCategory: 'electronics'.padEnd(80, 'x') })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('flags mismatch for RICH vision strings too (scan refine path sends eBay-style names, not the coarse enum)', async () => {
    vi.spyOn(EbayAdapter, 'getCategorySuggestion').mockResolvedValue({
      categoryId: '181335', categoryName: 'Baseball Jackets',
      rootCategoryId: '11450', rootCategoryName: 'Clothing, Shoes & Accessories',
    });
    vi.spyOn(EbayAdapter, 'getValidConditions').mockResolvedValue([]);

    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'Impeto Digital Fiber Optic Audio Cable', visionCategory: 'Audio Cables & Adapters' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mismatch).toBe(true);
  });

  it('returns {suggestion: null} when the Taxonomy API has no suggestion', async () => {
    vi.spyOn(EbayAdapter, 'getCategorySuggestion').mockResolvedValue(null);
    const conditionsSpy = vi.spyOn(EbayAdapter, 'getValidConditions');

    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'zzz unfindable' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestion: null });
    expect(conditionsSpy).not.toHaveBeenCalled();
  });

  it('still returns the suggestion with empty conditionIds when the Metadata lookup throws', async () => {
    // A conditions failure must not 500 the whole route — the suggestion alone
    // is still useful; the client treats [] as "constrain nothing".
    vi.spyOn(EbayAdapter, 'getCategorySuggestion').mockResolvedValue({ categoryId: '619', categoryName: 'Guitar Amplifiers', rootCategoryId: null, rootCategoryName: null });
    vi.spyOn(EbayAdapter, 'getValidConditions').mockRejectedValue(new Error('metadata token failure'));

    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'fender deluxe reverb amp' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      suggestion: { categoryId: '619', categoryName: 'Guitar Amplifiers', rootCategoryId: null, rootCategoryName: null, conditionIds: [] },
      mismatch: false,
    });
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'amp' });

    expect(res.status).toBe(401);
  });

  it('returns 400 VALIDATION_ERROR when q is missing', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('increments the portage_ebay_taxonomy_calls_total counter per lookup', async () => {
    vi.spyOn(EbayAdapter, 'getCategorySuggestion').mockResolvedValue(null);
    metrics.ebayTaxonomyCalls.reset();

    await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'fender amp' })
      .set('Authorization', `Bearer ${token}`);

    const metric = await metrics.ebayTaxonomyCalls.get();
    expect(metric.values).toEqual([
      { labels: { operation: 'category_suggestion' }, value: 1 },
    ]);
  });

  it('returns 400 VALIDATION_ERROR when q exceeds 200 characters', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/category-suggestion')
      .query({ q: 'x'.repeat(201) })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /marketplace/ebay/category-aspects/:categoryId', () => {
  it('returns the required-aspect schema for a category', async () => {
    vi.spyOn(EbayAdapter, 'getRequiredAspects').mockResolvedValue({
      'Preamp Type': { required: true, values: ['Tube', 'Solid State'], cardinality: 'SINGLE' },
      Brand: { required: true, values: null, cardinality: 'SINGLE' },
    });

    const res = await request(app)
      .get('/marketplace/ebay/category-aspects/119018')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(EbayAdapter.getRequiredAspects).toHaveBeenCalledWith('119018');
    expect(res.body.aspects['Preamp Type']).toEqual({ required: true, values: ['Tube', 'Solid State'], cardinality: 'SINGLE' });
  });
});
