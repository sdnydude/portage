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

const SHIP_FROM = {
  name: 'Jane Seller',
  street1: '123 Main St',
  street2: 'Apt 4',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  country: 'US',
};

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

// URL + method routed fetch — the REAL adapter runs against this, so the same
// stub serves both the GET idempotency reads and the POST create calls.
function routedFetch(overrides: Record<string, Response> = {}) {
  return vi.fn(async (url: any, opts: any) => {
    const u = String(url);
    const method = (opts?.method ?? 'GET').toUpperCase();
    const key = `${method} ${
      u.includes('/fulfillment_policy') ? 'fulfillment' :
      u.includes('/payment_policy') ? 'payment' :
      u.includes('/return_policy') ? 'return' :
      (u.includes('/inventory/v1/location') && !u.includes('/location/')) ? 'location-list' :
      u.includes('/location/') ? 'location' :
      u.includes('/commerce/identity') ? 'identity' : 'other'
    }`;
    if (overrides[key]) return overrides[key].clone();
    // sensible defaults: empty policy lists, location absent, creates succeed
    switch (key) {
      case 'GET fulfillment': return new Response(JSON.stringify({ fulfillmentPolicies: [] }), { status: 200 });
      case 'GET payment': return new Response(JSON.stringify({ paymentPolicies: [] }), { status: 200 });
      case 'GET return': return new Response(JSON.stringify({ returnPolicies: [] }), { status: 200 });
      case 'POST fulfillment': return new Response(JSON.stringify({ fulfillmentPolicyId: 'fp-1' }), { status: 201 });
      case 'POST payment': return new Response(JSON.stringify({ paymentPolicyId: 'pp-1' }), { status: 201 });
      case 'POST return': return new Response(JSON.stringify({ returnPolicyId: 'rp-1' }), { status: 201 });
      case 'GET location-list': return new Response(JSON.stringify({ locations: [] }), { status: 200 });
      case 'GET identity': return new Response(JSON.stringify({ userId: 'ebay-u' }), { status: 200 });
      case 'GET location': return new Response('', { status: 404 });
      case 'POST location': return new Response(null, { status: 204 });
      default: return new Response('{}', { status: 200 });
    }
  });
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
});

describe('POST /seller-profile/ebay/auto-setup', () => {
  it('returns 400 when no eBay account is connected', async () => {
    mockSelectOnce([]); // marketplaceAccounts: not connected

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EBAY_NOT_CONNECTED');
  });

  it('creates the 3 Portage Standard policies + inventory location, persists, and returns setup', async () => {
    mockSelectOnce([{ id: 'acc-1' }]); // connected
    mockSelectOnce([{ id: 'sp-1', userId: 'test-user-id', shipFromAddress: SHIP_FROM, ebayMerchantLocationKey: null }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'sp-1' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.setup.fulfillmentPolicyId).toBe('fp-1');
    expect(res.body.setup.paymentPolicyId).toBe('pp-1');
    expect(res.body.setup.returnPolicyId).toBe('rp-1');
    expect(res.body.setup.merchantLocationKey).toBe('portage-primary');
    expect(res.body.setup.locationConfigured).toBe(true);

    // the location was actually created (POST) with the seller's mapped address
    const locationPost = fetchMock.mock.calls.find(
      ([u, o]: any[]) => String(u).includes('/location/portage-primary') && (o?.method ?? 'GET').toUpperCase() === 'POST',
    );
    expect(locationPost).toBeTruthy();
    const locationBody = JSON.parse((locationPost![1] as any).body);
    expect(locationBody.location.address).toEqual({
      addressLine1: '123 Main St',
      addressLine2: 'Apt 4',
      city: 'Austin',
      stateOrProvince: 'TX',
      postalCode: '78701',
      country: 'US',
    });

    // the ids were persisted to the seller profile
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      ebayFulfillmentPolicyId: 'fp-1',
      ebayPaymentPolicyId: 'pp-1',
      ebayReturnPolicyId: 'rp-1',
      ebayMerchantLocationKey: 'portage-primary',
    }));
  });

  it('reuses existing Portage Standard policies + location instead of creating duplicates', async () => {
    mockSelectOnce([{ id: 'acc-1' }]); // connected
    mockSelectOnce([{ id: 'sp-1', userId: 'test-user-id', shipFromAddress: SHIP_FROM, ebayMerchantLocationKey: 'portage-primary' }]);
    mockUpdateReturns([{ id: 'sp-1' }]);

    const fetchMock = routedFetch({
      'GET fulfillment': new Response(JSON.stringify({ fulfillmentPolicies: [{ fulfillmentPolicyId: 'fp-existing', name: 'Portage Standard Fulfillment' }] }), { status: 200 }),
      'GET payment': new Response(JSON.stringify({ paymentPolicies: [{ paymentPolicyId: 'pp-existing', name: 'Portage Standard Payment' }] }), { status: 200 }),
      'GET return': new Response(JSON.stringify({ returnPolicies: [{ returnPolicyId: 'rp-existing', name: 'Portage Standard Return' }] }), { status: 200 }),
      'GET location': new Response(JSON.stringify({ merchantLocationKey: 'portage-primary' }), { status: 200 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.setup.fulfillmentPolicyId).toBe('fp-existing');
    expect(res.body.setup.paymentPolicyId).toBe('pp-existing');
    expect(res.body.setup.returnPolicyId).toBe('rp-existing');

    // nothing was created — no POST to any policy or location endpoint
    const anyCreate = fetchMock.mock.calls.find(([, o]: any[]) => (o?.method ?? 'GET').toUpperCase() === 'POST');
    expect(anyCreate).toBeUndefined();
  });

  it('returns 400 when no seller profile exists (null guard)', async () => {
    mockSelectOnce([{ id: 'acc-1' }]); // connected
    mockSelectOnce([]); // no seller profile

    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SELLER_PROFILE_REQUIRED');
  });

  it('rejects setup with SHIP_FROM_REQUIRED when no ship-from address is set (no silent partial setup)', async () => {
    mockSelectOnce([{ id: 'acc-1' }]); // connected
    mockSelectOnce([{ id: 'sp-1', userId: 'test-user-id', shipFromAddress: null, ebayMerchantLocationKey: null }]);

    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SHIP_FROM_REQUIRED');

    // nothing was persisted (no partial setup) and no location was created
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
    const locationPost = fetchMock.mock.calls.find(
      ([u, o]: any[]) => String(u).includes('/location/') && (o?.method ?? 'GET').toUpperCase() === 'POST',
    );
    expect(locationPost).toBeUndefined();
  });

  it('pulls and uses an existing eBay inventory location (no manual ship-from needed)', async () => {
    mockSelectOnce([{ id: 'acc-1' }]); // connected
    mockSelectOnce([{ id: 'sp-1', userId: 'test-user-id', shipFromAddress: null, ebayMerchantLocationKey: null }]);
    mockUpdateReturns([{ id: 'sp-1' }]);

    const fetchMock = routedFetch({
      'GET location-list': new Response(JSON.stringify({ locations: [{ merchantLocationKey: 'ebay-loc-7' }] }), { status: 200 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.setup.merchantLocationKey).toBe('ebay-loc-7');
    expect(res.body.setup.locationConfigured).toBe(true);
  });

  it('sends a non-empty location name when the ship-from name is blank (eBay 25802 rejects empty name)', async () => {
    mockSelectOnce([{ id: 'acc-1' }]); // connected
    mockSelectOnce([{ id: 'sp-1', userId: 'test-user-id', shipFromAddress: { name: '', zip: '33308', country: 'US' }, ebayMerchantLocationKey: null }]);
    mockUpdateReturns([{ id: 'sp-1' }]);

    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const locationPost = fetchMock.mock.calls.find(
      ([u, o]: any[]) => String(u).includes('/location/') && (o?.method ?? 'GET').toUpperCase() === 'POST',
    );
    expect(locationPost).toBeTruthy();
    expect(JSON.parse((locationPost![1] as any).body).name).toBeTruthy();
  });

  it('pulls the ship-from address from eBay registration and creates the location (one-click, no manual entry)', async () => {
    mockSelectOnce([{ id: 'acc-1' }]); // connected
    mockSelectOnce([{ id: 'sp-1', userId: 'test-user-id', shipFromAddress: null, ebayMerchantLocationKey: null }]);
    mockUpdateReturns([{ id: 'sp-1' }]);

    const fetchMock = routedFetch({
      'GET identity': new Response(JSON.stringify({
        userId: 'ebay-u',
        businessAccount: { address: { addressLine1: '500 Oak Ave', city: 'Denver', stateOrProvince: 'CO', postalCode: '80202', country: 'US' } },
      }), { status: 200 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/seller-profile/ebay/auto-setup')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.setup.locationConfigured).toBe(true);
    const locationPost = fetchMock.mock.calls.find(
      ([u, o]: any[]) => String(u).includes('/location/') && (o?.method ?? 'GET').toUpperCase() === 'POST',
    );
    expect(locationPost).toBeTruthy();
    expect(JSON.parse((locationPost![1] as any).body).location.address.postalCode).toBe('80202');
  });
});
