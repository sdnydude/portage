vi.mock('./token-manager.js', () => ({
  getReverbAccessToken: vi.fn().mockResolvedValue('test-reverb-pat'),
}));

import { ReverbAdapter, REVERB_PHOTO_INGEST, clearReverbConditionsCache, clearReverbCategoriesCache } from './reverb-adapter.js';
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

// searchComps tests mutate REVERB_API_TOKEN + the env cache — restore both so
// leakage never bleeds into other suites in the same worker.
const ORIGINAL_REVERB_API_TOKEN = process.env.REVERB_API_TOKEN;

// No real sleeps in tests — the ingestion-poll delay is a test-tunable.
beforeEach(() => { REVERB_PHOTO_INGEST.delayMs = 0; });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getReverbAccessToken).mockResolvedValue('test-reverb-pat');
  // searchCategories + getFlatCategories share a module-level cache — clear it
  // so each test's stubbed fetch is what actually gets consumed.
  clearReverbCategoriesCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_REVERB_API_TOKEN === undefined) {
    delete process.env.REVERB_API_TOKEN;
  } else {
    process.env.REVERB_API_TOKEN = ORIGINAL_REVERB_API_TOKEN;
  }
  resetEnv();
});

describe('ReverbAdapter.setBump', () => {
  it('PUTs a bid above the fabricated 3.5% cap (Reverb suggests 4.5%+; real cap is 30%)', async () => {
    const fetchMock = stubFetch({}, true, 200);
    const adapter = new ReverbAdapter('user-1');
    await adapter.setBump('15191342', 0.075);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.reverb.com/api/bump/v2/bids');
    expect((init as RequestInit).method).toBe('PUT');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ products: [15191342], bid: 0.075 });
  });
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

  it('maps every Portage condition to the live-verified Reverb condition UUID', async () => {
    // Pinned against GET /api/listing_conditions (live, 2026-07-08).
    const expected: Record<string, string> = {
      new: '7c3f45de-2ae0-4c81-8400-fdb6b1d74890',       // Brand New
      like_new: 'ac5b9c1e-dc78-466d-b0b3-7cf712967a48',  // Mint
      good: 'f7a3f48c-972a-44c6-b01a-0cd27488d3f6',      // Good
      fair: '98777886-76d0-44c8-865e-bb40e669e934',      // Fair
      poor: '6a9dfcad-600b-46c8-9e08-ce6e5057921e',      // Poor
    };
    const adapter = new ReverbAdapter('user-1');

    for (const [condition, uuid] of Object.entries(expected)) {
      const fetchMock = stubFetch();
      await adapter.createListing({ ...BASE_INPUT, condition });
      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
      expect({ condition, sent: body.condition }).toEqual({ condition, sent: { uuid } });
    }
  });

  it('folds a warning into the result when an unrecognized condition falls back to good', async () => {
    const fetchMock = stubFetch();
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing({ ...BASE_INPUT, condition: 'mint' });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.condition).toEqual({ uuid: 'f7a3f48c-972a-44c6-b01a-0cd27488d3f6' }); // good
    expect(result.warning).toMatch(/condition/i);
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
      // Non-live create states retry publish via PUT, then warn that the
      // listing is parked in Reverb drafts.
      warning: expect.stringMatching(/saved the listing as a draft/),
    });
  });

  it('recognizes the object state shape ({slug:"live"}) Reverb actually returns', async () => {
    stubFetch({
      listing: { id: 999, state: { slug: 'live', description: 'Live' }, _links: { web: { href: 'https://reverb.com/item/999' } } },
    });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing(BASE_INPUT);
    expect(result.status).toBe('active');
  });
});

describe('ReverbAdapter.createListing — publish retry + verbatim blockers', () => {
  // Live-verified 2026-07-21: POST with publish:"true" that fails Reverb's
  // publish validation returns 201 state=draft with NO error — the listing
  // parks in Reverb drafts silently and never flips live on its own (the
  // earlier "async flip" theory was wrong — Stephen was publishing manually).
  // A follow-up PUT publish surfaces the exact blockers verbatim
  // (e.g. "Please set a shipping rate or enable local pickup.").
  it('retries publish via PUT when create returns non-live, and surfaces Reverb\'s verbatim blocker message on 422', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ listing: { id: 555, state: { slug: 'draft' } } }),
        { status: 201, headers: { 'Content-Type': 'application/hal+json' } },
      ))
      // ingestion-poll GET: photos already ingested
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ listing: { id: 555, state: { slug: 'draft' }, photos: [{}] } }),
        { status: 200, headers: { 'Content-Type': 'application/hal+json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Please set a shipping rate or enable local pickup.' }),
        { status: 422, headers: { 'Content-Type': 'application/hal+json' } },
      ));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing(BASE_INPUT);

    const [putUrl, putInit] = fetchMock.mock.calls[2];
    expect(putUrl).toBe('https://api.reverb.com/api/listings/555');
    expect(putInit!.method).toBe('PUT');
    expect(JSON.parse(putInit!.body as string)).toEqual({ publish: 'true' });
    expect(result.status).toBe('draft');
    expect(result.warning).toContain('Please set a shipping rate or enable local pickup.');
  });
});

describe('ReverbAdapter.createListing — non-live create state', () => {
  // A non-live create means publish validation soft-failed (silent 201 draft).
  // The adapter retries publish via PUT; if Reverb still reports non-live with
  // no error, warn that the listing is parked in drafts — never claim it will
  // go live on its own (it won't; live-verified 2026-07-21).
  it('warns that the listing is parked in Reverb drafts when the publish retry also returns non-live', async () => {
    stubFetch({
      listing: { id: 555, state: { slug: 'draft', description: 'Draft' } },
    });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing(BASE_INPUT);

    expect(result.status).toBe('draft');
    expect(result.warning).toMatch(/saved the listing as a draft \(state: draft\)/i);
  });
});

describe('ReverbAdapter.createListing — shipping profile reference', () => {
  // Reverb strongly discourages per-listing shipping_rates; the recommended
  // path is referencing a Reverb-side shipping profile by id. When a profile
  // id is present it wins — sending both would be redundant.
  it('sends shipping_profile_id instead of shipping rates when shippingProfileId is set', async () => {
    const fetchMock = stubFetch();
    const adapter = new ReverbAdapter('user-1');

    await adapter.createListing({
      ...BASE_INPUT,
      marketplaceSpecific: {
        shippingProfileId: '456',
        shippingRates: [{ regionCode: 'US_CON', rate: { amount: '12.00', currency: 'USD' } }],
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.shipping_profile_id).toBe('456');
    expect(body.shipping).toBeUndefined();
  });
});

describe('ReverbAdapter.createListing — UPC requirement for Brand New', () => {
  // Reverb blocks publish on Brand New items without a UPC: "A valid UPC/EAN
  // must be entered in the UPC field or the 'UPC does not apply' field must be
  // marked true for a Brand New item" (verbatim from the live shop 2026-07-21).
  it('sends upc_does_not_apply for a new-condition item with no upc', async () => {
    const fetchMock = stubFetch();
    const adapter = new ReverbAdapter('user-1');

    await adapter.createListing({ ...BASE_INPUT, condition: 'new' });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.upc_does_not_apply).toBe('true');
    expect(body.upc).toBeUndefined();
  });
});

describe('ReverbAdapter.createListing — condition notes', () => {
  // Reverb's API has no condition-notes/condition-description field (only the
  // main description), so the notes must ride inside the description or they
  // never reach the marketplace at all.
  it('appends conditionNotes to the description sent to Reverb', async () => {
    const fetchMock = stubFetch();
    const adapter = new ReverbAdapter('user-1');

    await adapter.createListing({
      ...BASE_INPUT,
      conditionNotes: 'Small ding on the lower bout, frets show light wear.',
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.description).toBe(
      'A fine guitar\n\nCondition notes: Small ding on the lower bout, frets show light wear.',
    );
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

  it('maps brand/model to make/model so item edits reach the Reverb listing', async () => {
    const fetchMock = stubFetch({});
    const adapter = new ReverbAdapter('user-1');

    await adapter.updateListing('12345678', {
      brand: 'Fender',
      model: 'Stratocaster',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.make).toBe('Fender');
    expect(body.model).toBe('Stratocaster');
  });
});

describe('ReverbAdapter.updateListing — publish passthrough', () => {
  // A Portage draft row that already has a marketplaceListingId means the
  // listing EXISTS on Reverb as a remote draft — re-publishing must PUT
  // publish on that listing, never POST a second one (double-list).
  it('sends publish:"true" on update when marketplaceSpecific.publish is set', async () => {
    const fetchMock = stubFetch({ listing: { state: { slug: 'live' } } });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.updateListing('99270095', {
      price: 76.08,
      marketplaceSpecific: { publish: true },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init!.body as string).publish).toBe('true');
    expect(result.status).toBe('active');
  });
});

describe('ReverbAdapter.updateListing — shipping profile reference', () => {
  it('sends shipping_profile_id on update when shippingProfileId is set', async () => {
    const fetchMock = stubFetch({ listing: { state: { slug: 'live' } } });
    const adapter = new ReverbAdapter('user-1');

    await adapter.updateListing('99606134', {
      marketplaceSpecific: {
        shippingProfileId: '456',
        shippingRates: [{ regionCode: 'US_CON', rate: { amount: '12.00', currency: 'USD' } }],
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.shipping_profile_id).toBe('456');
    expect(body.shipping).toBeUndefined();
  });

  it('sends shipping {local:true} on update for a pickup-only listing (no profile, no rates) — create/update parity', async () => {
    const fetchMock = stubFetch({ listing: { state: { slug: 'live' } } });
    const adapter = new ReverbAdapter('user-1');

    await adapter.updateListing('99606134', {
      marketplaceSpecific: { localPickup: true },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.shipping).toEqual({ local: true });
    expect(body.shipping_profile_id).toBeUndefined();
  });
});

describe('ReverbAdapter.updateListing — UPC on publish', () => {
  it('sends upc_does_not_apply when publishing a new-condition listing without a upc', async () => {
    const fetchMock = stubFetch({ listing: { state: { slug: 'live' } } });
    const adapter = new ReverbAdapter('user-1');

    await adapter.updateListing('99606134', {
      condition: 'new',
      marketplaceSpecific: { publish: true },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.upc_does_not_apply).toBe('true');
  });
});

describe('ReverbAdapter.updateListing — condition notes', () => {
  it('appends conditionNotes to the description on update', async () => {
    const fetchMock = stubFetch({ listing: { state: 'live' } });
    const adapter = new ReverbAdapter('user-1');

    await adapter.updateListing('99999', {
      description: 'Updated description',
      conditionNotes: 'Replaced pots in 2020.',
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.description).toBe('Updated description\n\nCondition notes: Replaced pots in 2020.');
  });
});

describe('ReverbAdapter.updateListing — stale photo cleanup', () => {
  /** Routes fetch by URL+method so the PUT → GET images → DELETE flow can be scripted. */
  function stubFetchRouted(routes: Array<{ match: (url: string, method: string) => boolean; status?: number; body?: unknown }>) {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const route = routes.find(r => r.match(url, method));
      if (!route) throw new Error(`unrouted fetch: ${method} ${url}`);
      const status = route.status ?? 200;
      // Response() rejects a body on 204 — send null like the real API does.
      return new Response(status === 204 ? null : JSON.stringify(route.body ?? {}), {
        status,
        headers: { 'Content-Type': 'application/hal+json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('DELETEs remote images whose original_url is no longer in the photo set (live-pinned shape: {images:[{id, original_url}]})', async () => {
    const fetchMock = stubFetchRouted([
      { match: (u, m) => m === 'PUT' && u.endsWith('/listings/12345678'), body: { listing: { state: 'live' } } },
      { match: (u, m) => m === 'GET' && u.endsWith('/listings/12345678/images'), body: { images: [
        { id: 111, original_url: 'https://img.example/keep.jpg', position: 0 },
        { id: 222, original_url: 'https://img.example/removed.jpg', position: 1 },
      ] } },
      { match: (u, m) => m === 'DELETE' && u.endsWith('/listings/12345678/images/222'), status: 204 },
    ]);
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.updateListing('12345678', {
      photos: [{ url: 'https://img.example/keep.jpg' }],
    });

    // override_position only replaces positions — a dropped photo lingers on
    // Reverb until its per-image DELETE is called.
    const deletes = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0][0]).toBe('https://api.reverb.com/api/listings/12345678/images/222');
    expect(result.warning).toBeUndefined();
  });

  it('leaves kept images and images without an original_url (dashboard uploads) alone', async () => {
    const fetchMock = stubFetchRouted([
      { match: (u, m) => m === 'PUT' && u.endsWith('/listings/12345678'), body: { listing: { state: 'live' } } },
      { match: (u, m) => m === 'GET' && u.endsWith('/listings/12345678/images'), body: { images: [
        { id: 111, original_url: 'https://img.example/keep.jpg', position: 0 },
        { id: 333, position: 1 }, // uploaded via the Reverb dashboard — unknown origin, never ours to delete
      ] } },
    ]);
    const adapter = new ReverbAdapter('user-1');

    await adapter.updateListing('12345678', {
      photos: [{ url: 'https://img.example/keep.jpg' }],
    });

    const deletes = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'DELETE');
    expect(deletes).toHaveLength(0);
  });

  it('degrades a failed cleanup to a warning — the update itself already took', async () => {
    stubFetchRouted([
      { match: (u, m) => m === 'PUT' && u.endsWith('/listings/12345678'), body: { listing: { state: 'live' } } },
      { match: (u, m) => m === 'GET' && u.endsWith('/listings/12345678/images'), status: 500, body: { message: 'boom' } },
    ]);
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.updateListing('12345678', {
      photos: [{ url: 'https://img.example/keep.jpg' }],
    });

    // Throwing here would make the route report "failed to sync" for an update
    // that Reverb already accepted — degrade to a photo-specific warning instead.
    expect(result.status).toBe('active');
    expect(result.warning).toMatch(/photo/i);
  });

  it('keeps deleting the remaining stale images when one DELETE fails, and says how many were left behind', async () => {
    const fetchMock = stubFetchRouted([
      { match: (u, m) => m === 'PUT' && u.endsWith('/listings/12345678'), body: { listing: { state: 'live' } } },
      { match: (u, m) => m === 'GET' && u.endsWith('/listings/12345678/images'), body: { images: [
        { id: 111, original_url: 'https://img.example/keep.jpg', position: 0 },
        { id: 222, original_url: 'https://img.example/gone-a.jpg', position: 1 },
        { id: 333, original_url: 'https://img.example/gone-b.jpg', position: 2 },
      ] } },
      { match: (u, m) => m === 'DELETE' && u.endsWith('/images/222'), status: 500, body: { message: 'boom' } },
      { match: (u, m) => m === 'DELETE' && u.endsWith('/images/333'), status: 204 },
    ]);
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.updateListing('12345678', {
      photos: [{ url: 'https://img.example/keep.jpg' }],
    });

    const deletes = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'DELETE');
    expect(deletes).toHaveLength(2); // the 500 on 222 must not abort 333's delete
    expect(result.warning).toBe('1 removed photo(s) could not be deleted on Reverb');
  });
});

describe('ReverbAdapter.updateListing — status mapping', () => {
  it('reflects the PUT response state instead of assuming active', async () => {
    stubFetch({ listing: { id: 12345678, state: 'draft' } });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.updateListing('12345678', { price: 999, currency: 'USD' });
    expect(result.status).toBe('draft');
  });

  it('recognizes the object state shape ({slug:"live"}) on the PUT response', async () => {
    stubFetch({ listing: { id: 12345678, state: { slug: 'live', description: 'Live' } } });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.updateListing('12345678', { price: 999, currency: 'USD' });
    expect(result.status).toBe('active');
  });

  it('does not collapse a terminal state (sold/ended) into draft — keeps active with a warning', async () => {
    stubFetch({ listing: { id: 12345678, state: { slug: 'sold', description: 'Sold' } } });
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.updateListing('12345678', { price: 999, currency: 'USD' });
    expect(result.status).toBe('active');
    expect(result.warning).toMatch(/sold/i);
  });
});

describe('ReverbAdapter.deleteListing — live listings end, drafts delete', () => {
  // Live-verified 2026-07-21: DELETE /listings/:id 400s with "Only drafts can
  // be deleted" on a live listing — a live one must be ENDED via
  // PUT /my/listings/:id/state/end {reason:"not_sold"}. Without the fallback,
  // archive/delete of published reverb listings silently left them live.
  it('falls back to the state/end call when DELETE reports the listing is not a draft', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Only drafts can be deleted' }),
        { status: 400, headers: { 'Content-Type': 'application/hal+json' } },
      ))
      .mockResolvedValueOnce(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/hal+json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new ReverbAdapter('user-1');

    await adapter.deleteListing('99606179');

    const [endUrl, endInit] = fetchMock.mock.calls[1];
    expect(endUrl).toBe('https://api.reverb.com/api/my/listings/99606179/state/end');
    expect(endInit!.method).toBe('PUT');
    expect(JSON.parse(endInit!.body as string)).toEqual({ reason: 'not_sold' });
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

  it('reads the object state shape ({slug}) the live GET endpoint returns', async () => {
    const adapter = new ReverbAdapter('user-1');

    stubFetch({ state: { slug: 'live', description: 'Live' } });
    expect(await adapter.getListingStatus('1')).toBe('active');

    stubFetch({ state: { slug: 'sold', description: 'Sold' } });
    expect(await adapter.getListingStatus('1')).toBe('sold');
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

describe('ReverbAdapter.searchCategories', () => {
  // Live-verified 2026-07-21: GET /categories/flat IGNORES its ?query= param —
  // identical 320-row list for any query. Matching must happen client-side or
  // every caller gets "Acoustic Guitars / 12-String" (the first flat entry)
  // regardless of what the item is.
  it('filters the flat list client-side so a pedal query never returns guitar categories', async () => {
    stubFetch({
      categories: [
        { uuid: 'uuid-12string', full_name: 'Acoustic Guitars / 12-String' },
        { uuid: 'uuid-distortion', full_name: 'Effects and Pedals / Distortion' },
        { uuid: 'uuid-mics', full_name: 'Pro Audio / Microphones' },
      ],
    });
    const adapter = new ReverbAdapter('user-1');

    const results = await adapter.searchCategories('distortion pedal');

    expect(results.map(r => r.id)).toEqual(['uuid-distortion']);
  });

  // Live repro 2026-07-21: item category "Solid State Drives" matched
  // "Electric Guitars / Solid Body" on the single token "solid" and published
  // an SSD as a guitar. A lone token hit out of several is noise — require a
  // majority of the query tokens to match before trusting a category.
  it('rejects minority-token matches — "solid state drives" must not match Electric Guitars / Solid Body', async () => {
    stubFetch({
      categories: [
        { uuid: 'uuid-solidbody', full_name: 'Electric Guitars / Solid Body' },
        { uuid: 'uuid-distortion', full_name: 'Effects and Pedals / Distortion' },
      ],
    });
    const adapter = new ReverbAdapter('user-1');

    expect(await adapter.searchCategories('solid state drives')).toEqual([]);
  });

  it('derives path segments with the real " / " separator (was split on " > " — always 1 element)', async () => {
    stubFetch({
      categories: [
        { uuid: 'uuid-distortion', full_name: 'Effects and Pedals / Distortion' },
      ],
    });
    const adapter = new ReverbAdapter('user-1');
    const [result] = await adapter.searchCategories('distortion pedals effects');
    expect(result.path).toEqual(['Effects and Pedals', 'Distortion']);
  });

  it('returns [] when nothing matches so the route 422 guard fires instead of a blind first-entry guess', async () => {
    stubFetch({
      categories: [
        { uuid: 'uuid-12string', full_name: 'Acoustic Guitars / 12-String' },
        { uuid: 'uuid-distortion', full_name: 'Effects and Pedals / Distortion' },
      ],
    });
    const adapter = new ReverbAdapter('user-1');

    expect(await adapter.searchCategories('vintage film camera')).toEqual([]);
  });
});

describe('ReverbAdapter.getShippingProfiles', () => {
  // Reverb's recommended shipping setup: profiles created ON Reverb
  // (reverb.com/my/selling/shipping_rates — not creatable via API) and
  // referenced per listing by shipping_profile_id. GET /shop lists them.
  it('reads the shop shipping profiles from GET /shop', async () => {
    const fetchMock = stubFetch({
      name: 'Digital Harmony Group Closet',
      shipping_profiles: [
        { id: '456', name: 'Pedals + small gear' },
        { id: '789', name: 'Heavy amps' },
      ],
    });
    const adapter = new ReverbAdapter('user-1');

    const profiles = await adapter.getShippingProfiles();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.reverb.com/api/shop');
    expect(profiles).toEqual([
      { id: '456', name: 'Pedals + small gear' },
      { id: '789', name: 'Heavy amps' },
    ]);
  });
});

describe('ReverbAdapter.getFlatCategories', () => {
  // The flat list is static reference data (320 rows) fetched on a public,
  // unauthenticated endpoint — cache it like getConditions so prepare +
  // category search don't refetch it on every call.
  it('caches the flat list across calls and clearReverbCategoriesCache forces a refetch', async () => {
    const fetchMock = stubFetch({
      categories: [{ uuid: 'u1', full_name: 'Effects and Pedals / Distortion' }],
    });

    const first = await ReverbAdapter.getFlatCategories();
    const second = await ReverbAdapter.getFlatCategories();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first[0]).toEqual({
      uuid: 'u1', fullName: 'Effects and Pedals / Distortion',
      // Hierarchy fields default sanely when the payload omits them.
      name: 'Distortion', rootUuid: '', listable: true,
    });

    clearReverbCategoriesCache();
    await ReverbAdapter.getFlatCategories();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('getProductTypes returns only the 14 root entries (fullName === name)', async () => {
    stubFetch({
      categories: [
        { uuid: 'root-fx', full_name: 'Effects and Pedals', name: 'Effects and Pedals', root_uuid: 'root-fx', listable: true },
        { uuid: 'u1', full_name: 'Effects and Pedals / Distortion', name: 'Distortion', root_uuid: 'root-fx', listable: true },
        { uuid: 'root-keys', full_name: 'Keyboards and Synths', name: 'Keyboards and Synths', root_uuid: 'root-keys', listable: true },
      ],
    });
    const roots = await ReverbAdapter.getProductTypes();
    expect(roots.map(r => r.uuid)).toEqual(['root-fx', 'root-keys']);
  });

  it('getCategoryChildren returns DIRECT children only, safe for leaf names containing " / "', async () => {
    stubFetch({
      categories: [
        { uuid: 'root-keys', full_name: 'Keyboards and Synths', name: 'Keyboards and Synths', root_uuid: 'root-keys', listable: true },
        { uuid: 'u-acc', full_name: 'Keyboards and Synths / Keyboard and Synth Accessories', name: 'Keyboard and Synth Accessories', root_uuid: 'root-keys', listable: true },
        { uuid: 'u-mod', full_name: 'Keyboards and Synths / Keyboard and Synth Accessories / Modular Synth Accessories', name: 'Modular Synth Accessories', root_uuid: 'root-keys', listable: true },
        // Leaf whose NAME contains " / " — must be a child of u-mod, not split apart.
        { uuid: 'u-split', full_name: 'Keyboards and Synths / Keyboard and Synth Accessories / Modular Synth Accessories / Modular Synth Splitters / Hubs', name: 'Modular Synth Splitters / Hubs', root_uuid: 'root-keys', listable: true },
      ],
    });
    expect((await ReverbAdapter.getCategoryChildren('root-keys')).map(c => c.uuid)).toEqual(['u-acc']);
    expect((await ReverbAdapter.getCategoryChildren('u-mod')).map(c => c.uuid)).toEqual(['u-split']);
    expect(await ReverbAdapter.getCategoryChildren('u-split')).toEqual([]);
  });

  it('retains the hierarchy fields (name, rootUuid, listable) — cascades need them', async () => {
    stubFetch({
      categories: [{
        uuid: 'u1', full_name: 'Effects and Pedals / Distortion', name: 'Distortion',
        root_uuid: 'root-fx', listable: true,
      }],
    });
    const [cat] = await ReverbAdapter.getFlatCategories();
    expect(cat).toEqual({
      uuid: 'u1', fullName: 'Effects and Pedals / Distortion', name: 'Distortion',
      rootUuid: 'root-fx', listable: true,
    });
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

  it('throws a typed REVERB_API_ERROR when the conditions fetch fails', async () => {
    clearReverbConditionsCache();
    stubFetch(null, false, 503, 'Service Unavailable');

    await expect(ReverbAdapter.getConditions()).rejects.toMatchObject({
      statusCode: 503,
      code: 'REVERB_API_ERROR',
    });
  });
});

describe('ReverbAdapter.searchComps — degraded signal', () => {
  it('flags the result as degraded on an API failure so pricing can warn, distinct from genuinely-no-comps', async () => {
    process.env.REVERB_API_TOKEN = 'global-service-token';
    resetEnv();
    loadEnv();
    stubFetch(null, false, 429, 'rate limited');

    const result = await ReverbAdapter.searchComps('stratocaster');
    expect(result.stats.sampleSize).toBe(0);
    expect(result.degraded).toBe(true);
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

describe('ReverbAdapter.searchCategories — leaf-safe path derivation', () => {
  it('does not over-split a leaf name containing " / " (review finding)', async () => {
    stubFetch({
      categories: [{
        uuid: 'u-split',
        full_name: 'Keyboards and Synths / Keyboard and Synth Accessories / Modular Synth Accessories / Modular Synth Splitters / Hubs',
        name: 'Modular Synth Splitters / Hubs',
        root_uuid: 'r-keys', listable: true,
      }],
    });
    const adapter = new ReverbAdapter('user-1');
    const [hit] = await adapter.searchCategories('modular synth splitters hubs accessories');
    expect(hit.path).toEqual([
      'Keyboards and Synths', 'Keyboard and Synth Accessories', 'Modular Synth Accessories', 'Modular Synth Splitters / Hubs',
    ]);
  });
});

describe('ReverbAdapter.createListing — photo-ingestion race guard', () => {
  // Live failure 2026-08-04 (RC-30 100095335, Verb Square 100097689): POST
  // publish:"true" returns 201 draft, Reverb ingests photo URLs ASYNC, and
  // the immediate PUT publish retry 422'd "must have at least one image" in
  // the same second the listing was created. The retry must wait for
  // ingestion before publishing.
  beforeEach(() => { REVERB_PHOTO_INGEST.delayMs = 0; });

  it('polls the listing until photos are ingested before the publish retry, then goes live', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'draft' } } }), { status: 201, headers: { 'Content-Type': 'application/hal+json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'draft' }, photos: [] } }), { status: 200, headers: { 'Content-Type': 'application/hal+json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'draft' }, photos: [{ _links: {} }] } }), { status: 200, headers: { 'Content-Type': 'application/hal+json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'live' } } }), { status: 200, headers: { 'Content-Type': 'application/hal+json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing(BASE_INPUT);

    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit)?.method ?? 'GET')).toEqual(['POST', 'GET', 'GET', 'PUT']);
    expect(result.status).toBe('active');
    expect(result.warning).toBeUndefined();
  });

  it('gives up after the poll budget and still attempts the publish retry (existing draft-warning path)', async () => {
    const emptyGet = () => new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'draft' }, photos: [] } }), { status: 200, headers: { 'Content-Type': 'application/hal+json' } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'draft' } } }), { status: 201, headers: { 'Content-Type': 'application/hal+json' } }))
      .mockResolvedValueOnce(emptyGet())
      .mockResolvedValueOnce(emptyGet())
      .mockResolvedValueOnce(emptyGet())
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'You must have at least one image on your listing to submit it to the marketplace.' }), { status: 422, headers: { 'Content-Type': 'application/hal+json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new ReverbAdapter('user-1');

    const result = await adapter.createListing(BASE_INPUT);

    expect(fetchMock.mock.calls.length).toBe(5); // POST + 3 polls + PUT
    expect(result.status).toBe('draft');
    expect(result.warning).toContain('at least one image');
  });

  it('skips polling entirely when the input has no photos', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'draft' } } }), { status: 201, headers: { 'Content-Type': 'application/hal+json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 777, state: { slug: 'live' } } }), { status: 200, headers: { 'Content-Type': 'application/hal+json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new ReverbAdapter('user-1');

    await adapter.createListing({ ...BASE_INPUT, photos: [] });

    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit)?.method ?? 'GET')).toEqual(['POST', 'PUT']);
  });
});
