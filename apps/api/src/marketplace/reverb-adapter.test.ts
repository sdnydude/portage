vi.mock('./token-manager.js', () => ({
  getReverbAccessToken: vi.fn().mockResolvedValue('test-reverb-pat'),
}));

import { ReverbAdapter, clearReverbConditionsCache } from './reverb-adapter.js';
import { getReverbAccessToken } from './token-manager.js';
import { loadEnv, resetEnv } from '../lib/env.js';

const LISTING_RESPONSE = {
  listing: {
    id: 12345678,
    state: 'live',
    _links: { web: { href: 'https://reverb.com/item/12345678-test' } },
  },
};

function stubFetch(response: unknown = LISTING_RESPONSE, ok = true, status = 200, bodyText = '') {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(
    ok ? JSON.stringify(response) : bodyText,
    { status, headers: { 'Content-Type': 'application/hal+json' } },
  ));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const BASE_INPUT = {
  title: 'Fender Stratocaster',
  description: 'A fine guitar',
  price: 1200,
  currency: 'USD',
  category: 'Electric Guitars',
  condition: 'good',
  photos: [{ url: 'https://img.example/1.jpg', isPrimary: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getReverbAccessToken).mockResolvedValue('test-reverb-pat');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReverbAdapter.createListing', () => {
  it('resolves the per-user PAT via token-manager and sends it as Bearer auth', async () => {
    const fetchMock = stubFetch();
    const adapter = new ReverbAdapter('user-1');

    await adapter.createListing(BASE_INPUT);

    expect(vi.mocked(getReverbAccessToken)).toHaveBeenCalledWith('user-1');
    const [, init] = fetchMock.mock.calls[0];
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer test-reverb-pat');
  });

  it('sends publish:"true" and maps all listing fields into the Reverb body', async () => {
    const fetchMock = stubFetch();
    const adapter = new ReverbAdapter('user-1');

    await adapter.createListing({
      ...BASE_INPUT,
      brand: 'Fender',
      model: 'Stratocaster',
      quantity: 3,
      marketplaceSpecific: {
        categoryUuid: 'cat-uuid-1',
        conditionUuid: 'cond-uuid-1',
        year: '1979',
        finish: 'Sunburst',
        offersEnabled: false,
        shippingRates: [{ region_code: 'US_CON', rate: { amount: '25.00', currency: 'USD' } }],
        localPickup: true,
      },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.reverb.com/api/listings');
    expect(JSON.parse(init!.body as string)).toEqual({
      make: 'Fender',
      model: 'Stratocaster',
      title: 'Fender Stratocaster',
      description: 'A fine guitar',
      condition: { uuid: 'cond-uuid-1' },
      price: { amount: '1200', currency: 'USD' },
      has_inventory: true,
      inventory: 3,
      photos: ['https://img.example/1.jpg'],
      categories: [{ uuid: 'cat-uuid-1' }],
      year: '1979',
      finish: 'Sunburst',
      offers_enabled: false,
      shipping: { rates: [{ region_code: 'US_CON', rate: { amount: '25.00', currency: 'USD' } }], local: true },
      publish: 'true',
    });
  });

  it('normalizes profile-shaped shippingRates (camelCase regionCode) to the API region_code shape', async () => {
    const fetchMock = stubFetch();
    const adapter = new ReverbAdapter('user-1');

    await adapter.createListing({
      ...BASE_INPUT,
      marketplaceSpecific: {
        categoryUuid: 'cat-uuid-1',
        shippingRates: [{ regionCode: 'US_CON', rate: { amount: '45.00', currency: 'USD' } }],
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.shipping).toEqual({
      rates: [{ region_code: 'US_CON', rate: { amount: '45.00', currency: 'USD' } }],
      local: false,
    });
  });

  it('maps a Reverb 401 to 409 REVERB_RECONNECT_REQUIRED so the web client never mistakes it for a Portage session expiry', async () => {
    stubFetch(null, false, 401, JSON.stringify({ message: 'Invalid token' }));
    const adapter = new ReverbAdapter('user-1');

    await expect(adapter.createListing(BASE_INPUT)).rejects.toMatchObject({
      statusCode: 409,
      code: 'REVERB_RECONNECT_REQUIRED',
    });
  });

  it('maps a non-OK Reverb response to AppError(status, REVERB_API_ERROR) with the parsed message', async () => {
    stubFetch(null, false, 422, JSON.stringify({
      message: 'Category is required to publish',
      errors: { categories: ['is required'] },
    }));
    const adapter = new ReverbAdapter('user-1');

    await expect(adapter.createListing(BASE_INPUT)).rejects.toMatchObject({
      statusCode: 422,
      code: 'REVERB_API_ERROR',
      message: 'Category is required to publish',
    });
  });

  it('falls back to a constructed listing URL when the response has no _links.web', async () => {
    stubFetch({ listing: { id: 555, state: 'live' } });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing(BASE_INPUT);
    expect(result.marketplaceUrl).toBe('https://reverb.com/item/555');
  });

  it('maps a non-live response state to draft so the route never marks it active', async () => {
    stubFetch({
      listing: { id: 999, state: 'draft', _links: { web: { href: 'https://reverb.com/item/999' } } },
    });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing(BASE_INPUT);
    expect(result).toEqual({
      marketplaceListingId: '999',
      marketplaceUrl: 'https://reverb.com/item/999',
      status: 'draft',
    });
  });
});

describe('ReverbAdapter.updateListing', () => {
  it('maps the full partial input — condition, quantity, photos with override_position, and specific fields', async () => {
    const fetchMock = stubFetch({});
    const adapter = new ReverbAdapter('user-1');

    await adapter.updateListing('12345678', {
      title: 'New title',
      description: 'New description',
      price: 999,
      currency: 'USD',
      condition: 'like_new',
      quantity: 2,
      photos: [{ url: 'https://img.example/a.jpg' }, { url: 'https://img.example/b.jpg' }],
      marketplaceSpecific: {
        conditionUuid: 'cond-uuid-2',
        categoryUuid: 'cat-uuid-2',
        year: '1965',
        finish: 'Black',
        offersEnabled: true,
        shippingRates: [{ region_code: 'US_CON', rate: { amount: '30.00', currency: 'USD' } }],
      },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.reverb.com/api/listings/12345678');
    expect(init!.method).toBe('PUT');
    expect(JSON.parse(init!.body as string)).toEqual({
      title: 'New title',
      description: 'New description',
      price: { amount: '999', currency: 'USD' },
      condition: { uuid: 'cond-uuid-2' },
      inventory: 2,
      has_inventory: true,
      photos: ['https://img.example/a.jpg', 'https://img.example/b.jpg'],
      photo_upload_method: 'override_position',
      categories: [{ uuid: 'cat-uuid-2' }],
      year: '1965',
      finish: 'Black',
      offers_enabled: true,
      shipping: { rates: [{ region_code: 'US_CON', rate: { amount: '30.00', currency: 'USD' } }], local: false },
    });
  });
});

describe('ReverbAdapter.deleteListing', () => {
  it('issues DELETE against the listing path with per-user auth', async () => {
    const fetchMock = stubFetch({});
    const adapter = new ReverbAdapter('user-1');

    await adapter.deleteListing('12345678');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.reverb.com/api/listings/12345678');
    expect(init!.method).toBe('DELETE');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer test-reverb-pat');
  });
});

describe('ReverbAdapter.getListingStatus', () => {
  it('maps live/sold/ended states and returns unknown on API error', async () => {
    const adapter = new ReverbAdapter('user-1');

    stubFetch({ state: 'live' });
    expect(await adapter.getListingStatus('1')).toBe('active');

    stubFetch({ state: 'sold' });
    expect(await adapter.getListingStatus('1')).toBe('sold');

    stubFetch({ state: 'ended' });
    expect(await adapter.getListingStatus('1')).toBe('ended');

    stubFetch(null, false, 404, '{"message":"Not found"}');
    expect(await adapter.getListingStatus('1')).toBe('unknown');
  });

  it('returns unknown (not a throw) when the user has no connected Reverb account', async () => {
    stubFetch({ state: 'live' });
    vi.mocked(getReverbAccessToken).mockRejectedValueOnce(
      Object.assign(new Error('Reverb selling is not set up.'), { code: 'REVERB_SETUP_REQUIRED', statusCode: 400 }),
    );
    const adapter = new ReverbAdapter('user-1');

    expect(await adapter.getListingStatus('1')).toBe('unknown');
  });
});

describe('ReverbAdapter.getOrders', () => {
  it('maps selling orders including shipping address and since param', async () => {
    const fetchMock = stubFetch({
      orders: [{
        order_number: 'RV-100',
        listing_id: '12345678',
        buyer_name: 'Buyer Bob',
        amount_product: { amount: '850.00', currency: 'USD' },
        shipping: { amount: '35.00' },
        shipping_address: {
          name: 'Bob B',
          street_address: '1 Main St',
          extended_address: 'Apt 2',
          locality: 'Nashville',
          region: 'TN',
          postal_code: '37201',
          country_code: 'US',
        },
      }],
    });
    const adapter = new ReverbAdapter('user-1');
    const since = new Date('2026-07-01T00:00:00Z');

    const orders = await adapter.getOrders(since);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.reverb.com/api/my/orders/selling?created_after=${encodeURIComponent(since.toISOString())}`);
    expect(orders).toEqual([{
      marketplaceOrderId: 'RV-100',
      marketplaceListingId: '12345678',
      buyerUsername: 'Buyer Bob',
      salePrice: 850,
      shippingCost: 35,
      marketplaceFees: 0,
      currency: 'USD',
      shippingAddress: {
        name: 'Bob B',
        street1: '1 Main St',
        street2: 'Apt 2',
        city: 'Nashville',
        state: 'TN',
        zip: '37201',
        country: 'US',
      },
    }]);
  });
});

describe('ReverbAdapter.getConditions', () => {
  it('caches conditions across calls and clearReverbConditionsCache forces a refetch', async () => {
    const fetchMock = stubFetch({
      conditions: [{ uuid: 'c-1', display_name: 'Excellent' }],
    });

    clearReverbConditionsCache();
    const first = await ReverbAdapter.getConditions();
    const second = await ReverbAdapter.getConditions();
    expect(first).toEqual([{ uuid: 'c-1', displayName: 'Excellent' }]);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearReverbConditionsCache();
    await ReverbAdapter.getConditions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('ReverbAdapter.searchComps', () => {
  it('computes median/avg stats from priced comparison pages using the global env token', async () => {
    process.env.REVERB_API_TOKEN = 'global-service-token';
    resetEnv();
    loadEnv();
    const fetchMock = stubFetch({
      comparison_shopping_pages: [
        { title: 'Strat A', estimated_value: { price_center: { amount: '1000', currency: 'USD' } }, _links: { web: { href: 'https://reverb.com/a' } } },
        { title: 'Strat B', estimated_value: { price_center: { amount: '1500', currency: 'USD' } }, _links: { web: { href: 'https://reverb.com/b' } } },
        { title: 'No price', _links: { web: { href: 'https://reverb.com/c' } } },
      ],
    });

    const result = await ReverbAdapter.searchComps('stratocaster');

    const [, init] = fetchMock.mock.calls[0];
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer global-service-token');
    expect(result.stats).toEqual({ median: 1250, avg: 1250, sampleSize: 2 });
    expect(result.listings).toHaveLength(2);
  });
});
