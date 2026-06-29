import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadEnv } from '../lib/env.js';
import { resolveEbayCondition, resolveEbayConditionId, validateEbayListingFields, selectValidEbayCondition, resolveEbayCategoryCondition, resolveEbayCategoryId, EbayAdapter, EbayWeightRequiredError, clearEbayTaxonomyCaches } from './ebay-adapter.js';

vi.mock('./token-manager.js', () => ({
  getEbayAccessToken: vi.fn().mockResolvedValue('test-token'),
  getEbayProdAppToken: vi.fn().mockResolvedValue('test-app-token'),
  invalidateEbayProdAppToken: vi.fn(),
}));

const validSetup = {
  fulfillmentPolicyId: 'fp-1',
  paymentPolicyId: 'pp-1',
  returnPolicyId: 'rp-1',
  merchantLocationKey: 'loc-1',
};

const baseInput = {
  title: 'Test Item',
  description: 'A test item',
  price: 25,
  currency: 'USD',
  category: 'electronics',
  condition: 'good',
  photos: [{ url: 'https://portage-images.digitalharmonyai.com/p.jpg' }],
};

// Trade-First: createListing publishes via a single Trading AddFixedPriceItem call
// (POST .../ws/api.dll, XML). Pre-flight metadata calls (required aspects, valid
// conditions, taxonomy) stay on the REST request() path and get '{}' by default.
const ADD_ITEM_OK =
  '<?xml version="1.0" encoding="utf-8"?><AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemID>3001234567</ItemID></AddFixedPriceItemResponse>';
const isTradingCall = (url: unknown) => String(url).includes('/ws/api.dll');
/** The XML body sent to the Trading API (AddFixedPriceItem) on the most recent createListing. */
const tradingXml = () => {
  const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
  return call ? String((call[1] as RequestInit).body) : '';
};
/** Inline-terms publish setup: category + ship-from ZIP + package weight/dims (no policy IDs). */
const tradingSetup = {
  categoryId: '15032',
  originPostalCode: '10001',
  weight: { value: 8, unit: 'OUNCE' },
  dimensions: { length: 8, width: 6, height: 4, unit: 'INCH' },
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  loadEnv();
  // Module-level TTL caches survive between tests — clear so each test sees real fetches.
  clearEbayTaxonomyCaches();
  // Trading calls (ws/api.dll) get an AddFixedPriceItem success; everything else
  // (REST metadata/taxonomy) gets '{}'. Fresh Response per call (body reads once).
  fetchMock = vi.fn().mockImplementation(async (url: unknown) =>
    isTradingCall(url)
      ? new Response(ADD_ITEM_OK, { status: 200 })
      : new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EbayAdapter.searchComps — market-shape stats', () => {
  it('adds R-7 percentiles from the raw sold pool and sell-through to stats', async () => {
    const summary = (price: number) => ({
      title: `Item ${price}`,
      price: { value: String(price), currency: 'USD' },
      condition: 'Used',
      itemWebUrl: 'https://ebay.com/itm/1',
    });
    fetchMock.mockImplementation(async (url: unknown) => {
      const sold = String(url).includes('soldItemsOnly');
      return new Response(JSON.stringify({
        itemSummaries: sold
          ? [summary(10), summary(20), summary(30), summary(40)]
          : [summary(99)],
      }), { status: 200 });
    });

    const result = await EbayAdapter.searchComps('test query');

    // Raw sold pool [10,20,30,40]: R-7 p25 17.5 / p50 25 / p75 32.5.
    // sellThrough = sold / (sold + active) = 4/5 = 0.8.
    expect(result.stats.p25).toBe(17.5);
    expect(result.stats.p50).toBe(25);
    expect(result.stats.p75).toBe(32.5);
    expect(result.stats.sellThrough).toBe(0.8);

    // Single-currency pool enforcement: every Browse call must pin EBAY_US —
    // dropping this header would silently mix currencies into the price pool.
    const browseCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('item_summary/search'));
    expect(browseCalls.length).toBeGreaterThan(0);
    for (const [, opts] of browseCalls) {
      expect((opts as RequestInit & { headers: Record<string, string> }).headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US');
    }
  });

  it('returns null sellThrough and null percentiles when there are no comps at all (no spurious 0/0 badge)', async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));

    const result = await EbayAdapter.searchComps('no results query');

    expect(result.stats.sellThrough).toBeNull();
    expect(result.stats.p25).toBeNull();
    expect(result.stats.p50).toBeNull();
    expect(result.stats.p75).toBeNull();
  });
});

describe('resolveEbayCondition — Portage condition → eBay Inventory API enum', () => {
  it('maps to valid Inventory-API enums and prefers an explicit override', () => {
    expect(resolveEbayCondition('new')).toBe('NEW');
    expect(resolveEbayCondition('like_new')).toBe('USED_EXCELLENT');
    expect(resolveEbayCondition('good')).toBe('USED_GOOD');
    expect(resolveEbayCondition('fair')).toBe('USED_ACCEPTABLE');
    expect(resolveEbayCondition('poor')).toBe('USED_ACCEPTABLE');
    // unknown input falls back to a safe, broadly-valid used enum
    expect(resolveEbayCondition('mystery')).toBe('USED_GOOD');
    // an explicit marketplaceSpecific.condition (already a valid eBay enum) wins
    expect(resolveEbayCondition('good', { condition: 'USED_VERY_GOOD' })).toBe('USED_VERY_GOOD');
  });
});

describe('validateEbayListingFields — pre-flight publish guards', () => {
  it('requires a valid leaf categoryId and full eBay selling setup', () => {
    // missing categoryId
    expect(() => validateEbayListingFields({ ...validSetup })).toThrow(/category/i);
    // the broken "99" default must be rejected
    expect(() => validateEbayListingFields({ ...validSetup, categoryId: '99' })).toThrow(/category/i);
    // valid category but policies/location not set up
    expect(() => validateEbayListingFields({ categoryId: '15032' })).toThrow(/set up/i);
    // all present → returns the validated fields
    expect(validateEbayListingFields({ categoryId: '15032', ...validSetup })).toMatchObject({
      categoryId: '15032',
      merchantLocationKey: 'loc-1',
      fulfillmentPolicyId: 'fp-1',
      paymentPolicyId: 'pp-1',
      returnPolicyId: 'rp-1',
    });
  });
});

describe('EbayAdapter.createListing — guards before any eBay API call', () => {
  it('rejects when categoryId is missing, before any HTTP call', async () => {
    const adapter = new EbayAdapter('user-1');
    await expect(
      adapter.createListing({ ...baseInput, marketplaceSpecific: { originPostalCode: '10001' } } as any),
    ).rejects.toThrow(/category/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a live publish when ship-from origin ZIP is missing (inline Calculated shipping needs it)', async () => {
    const adapter = new EbayAdapter('user-1');
    await expect(
      adapter.createListing({
        ...baseInput,
        marketplaceSpecific: { categoryId: '15032', weight: { value: 8, unit: 'OUNCE' }, dimensions: { length: 8, width: 6, height: 4 } },
      } as any),
    ).rejects.toThrow(/ship.?from|origin|zip|postal/i);
  });

  it('wires the item quantity into the AddFixedPriceItem call', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      quantity: 7,
      marketplaceSpecific: { ...tradingSetup },
    } as any);
    expect(tradingXml()).toContain('<Quantity>7</Quantity>');
  });
});

describe('EbayAdapter.createListing — BrandMPN (error 25002) handling', () => {
  it('sends MPN "Does Not Apply" as an item-specific when the item has a brand but no real MPN', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      brand: 'Nextorage',
      marketplaceSpecific: { ...tradingSetup },
    } as any);
    const xml = tradingXml();
    expect(xml).toContain('<Name>Brand</Name><Value>Nextorage</Value>');
    expect(xml).toContain('<Name>MPN</Name><Value>Does Not Apply</Value>');
  });

  it('sends the real MPN (never the model name) as the MPN item-specific when provided', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      brand: 'Sony',
      model: 'WH-1000XM4',
      mpn: 'WH1000XM4/B',
      marketplaceSpecific: { ...tradingSetup },
    } as any);
    const xml = tradingXml();
    expect(xml).toContain('<Name>MPN</Name><Value>WH1000XM4/B</Value>');
    // Model is its own aspect; the MPN value must be the part number, never the model.
    expect(xml).toContain('<Name>Model</Name><Value>WH-1000XM4</Value>');
    expect(xml).not.toContain('<Name>MPN</Name><Value>WH-1000XM4</Value>');
  });
});

describe('EbayAdapter — request hygiene (User-Agent)', () => {
  it('sends a descriptive User-Agent on the Trading call — an anonymous fetch reads as a bot to eBay ATO', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: { ...tradingSetup },
    } as any);
    const call = fetchMock.mock.calls.find(([url]) => isTradingCall(url));
    expect(call).toBeTruthy();
    const headers = (call![1] as RequestInit).headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('PortageApp/1.0 (+https://portage.digitalharmonyai.com)');
  });

  it('sends the User-Agent on direct Browse calls too', async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));
    await EbayAdapter.searchComps('guitar');
    const browseCall = fetchMock.mock.calls.find(([u]) => String(u).includes('item_summary/search'));
    expect(browseCall).toBeTruthy();
    const headers = (browseCall![1] as RequestInit).headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('PortageApp/1.0 (+https://portage.digitalharmonyai.com)');
  });
});

describe('EbayAdapter.createListing — package weight/dimensions', () => {
  it('splits total ounces into lbs+oz and sends dimensions in ShippingPackageDetails', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: {
        ...tradingSetup,
        weight: { value: 24, unit: 'OUNCE' },
        dimensions: { length: 8, width: 6, height: 4, unit: 'INCH' },
      },
    } as any);
    const xml = tradingXml();
    expect(xml).toContain('<WeightMajor unit="lbs">1</WeightMajor>');
    expect(xml).toContain('<WeightMinor unit="oz">8</WeightMinor>');
    expect(xml).toContain('<PackageLength unit="in">8</PackageLength>');
    expect(xml).toContain('<PackageWidth unit="in">6</PackageWidth>');
    expect(xml).toContain('<PackageDepth unit="in">4</PackageDepth>');
  });
});

// NOTE: createListing aspect/gate coverage is being re-expressed against the Trading
// AddFixedPriceItem XML below (ITEM-SPECIFICS-MIGRATION marker). The Inventory-API
// product.aspects-JSON versions were removed — that behavior no longer exists.
describe('EbayAdapter.createListing — required-aspect gate (Trading)', () => {
  it('blocks publish with EbayAspectsRequiredError for an unfilled required aspect, before any AddFixedPriceItem call', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('get_item_aspects_for_category')) {
        return new Response(JSON.stringify({ aspects: [
          { localizedAspectName: 'Brand', aspectConstraint: { aspectRequired: true, itemToAspectCardinality: 'SINGLE' } },
          { localizedAspectName: 'Preamp Type', aspectConstraint: { aspectRequired: true, itemToAspectCardinality: 'SINGLE' }, aspectValues: [{ localizedValue: 'Tube' }, { localizedValue: 'Solid State' }] },
        ] }), { status: 200 });
      }
      return isTradingCall(url) ? new Response(ADD_ITEM_OK, { status: 200 }) : new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    await expect(adapter.createListing({
      ...baseInput, brand: 'Cloud Microphones',
      marketplaceSpecific: { ...tradingSetup, categoryId: '119018' },
    } as any)).rejects.toMatchObject({ code: 'EBAY_ASPECTS_REQUIRED', statusCode: 422, missing: [{ name: 'Preamp Type', values: ['Tube', 'Solid State'] }] });
    expect(fetchMock.mock.calls.find(([u]) => isTradingCall(u))).toBeUndefined();
  });
});

describe('EbayAdapter.createListing — Best Offer auto-accept (bestOfferTerms)', () => {
  // MIGRATION-PLACEHOLDER: createListing Best Offer (BestOfferAutoAcceptPrice in
  // AddFixedPriceItem XML + retry-without-Best-Offer downgrade) — re-added as Trading tests.

  it('updateListing omits listingPolicies entirely when the policy set is PARTIAL (eBay PUT would strip the missing ids)', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('listing-1', {
      price: 25,
      currency: 'USD',
      // fulfillment id present but payment/return missing — incomplete set.
      marketplaceSpecific: { fulfillmentPolicyId: 'fp-1', bestOfferAutoAcceptPrice: 18 },
    } as any);

    const putCall = fetchMock.mock.calls.find(([u, o]) => String(u).includes('/offer/') && (o as RequestInit).method === 'PUT');
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.listingPolicies).toBeUndefined();
    expect(body.pricingSummary.price.value).toBe('25');
  });

  it('updateListing normalizes scalar aspect values and backfills Brand/MPN (parity with createListing)', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('listing-1', {
      brand: 'Nextorage',
      currency: 'USD',
      ebaySku: 'PRT-000009', // inventory-item PUT (carries product.aspects) is gated on this
      marketplaceSpecific: { ...validSetup, aspects: { Type: 'Portable External SSD' } }, // scalar, not array
    } as any);

    const putCall = fetchMock.mock.calls.find(([u, o]) => String(u).includes('/inventory_item/') && (o as RequestInit).method === 'PUT');
    expect(putCall).toBeTruthy();
    const product = JSON.parse((putCall![1] as RequestInit).body as string).product;
    expect(product.aspects.Type).toEqual(['Portable External SSD']); // scalar coerced to array
    expect(product.aspects.Brand).toEqual(['Nextorage']);            // backfilled from input.brand
    expect(product.aspects.MPN).toEqual(['Does Not Apply']);         // BrandMPN sentinel mirrored
  });

  it('updateListing sends bestOfferTerms inside a COMPLETE listingPolicies block (never partial — eBay PUT replaces the object)', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('listing-1', {
      price: 25,
      currency: 'USD',
      marketplaceSpecific: { ...validSetup, bestOfferAutoAcceptPrice: 18 },
    } as any);

    const putCall = fetchMock.mock.calls.find(([u, o]) => String(u).includes('/offer/') && (o as RequestInit).method === 'PUT');
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.listingPolicies.bestOfferTerms).toEqual({
      bestOfferEnabled: true,
      autoAcceptPrice: { currency: 'USD', value: '18' },
    });
    expect(body.listingPolicies.fulfillmentPolicyId).toBe('fp-1');
    expect(body.listingPolicies.paymentPolicyId).toBe('pp-1');
    expect(body.listingPolicies.returnPolicyId).toBe('rp-1');
  });

  it('updateListing retries once WITHOUT listingPolicies when eBay rejects the best-offer terms', async () => {
    fetchMock.mockImplementation(async (url: any, opts: any) => {
      const u = String(url);
      if (u.includes('/offer/') && (opts as RequestInit).method === 'PUT') {
        const body = JSON.parse((opts as RequestInit).body as string);
        if (body.listingPolicies?.bestOfferTerms) {
          return new Response(JSON.stringify({ errors: [{ message: 'Best Offer is not supported for this category.' }] }), { status: 400 });
        }
        return new Response('{}', { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.updateListing('listing-1', {
      price: 25,
      currency: 'USD',
      marketplaceSpecific: { ...validSetup, bestOfferAutoAcceptPrice: 18 },
    } as any);

    expect(result.status).toBe('active');
    const putCalls = fetchMock.mock.calls.filter(([u, o]) => String(u).includes('/offer/') && (o as RequestInit).method === 'PUT');
    expect(putCalls).toHaveLength(2);
    const retryBody = JSON.parse((putCalls[1][1] as RequestInit).body as string);
    expect(retryBody.listingPolicies).toBeUndefined();
    expect(retryBody.pricingSummary.price.value).toBe('25');
  });

  it('updateListing surfaces a warning on the result when the Best Offer retry downgrade fires', async () => {
    fetchMock.mockImplementation(async (url: any, opts: any) => {
      const u = String(url);
      if (u.includes('/offer/') && (opts as RequestInit).method === 'PUT') {
        const body = JSON.parse((opts as RequestInit).body as string);
        if (body.listingPolicies?.bestOfferTerms) {
          return new Response(JSON.stringify({ errors: [{ message: 'Best Offer is not supported for this category.' }] }), { status: 400 });
        }
        return new Response('{}', { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.updateListing('listing-1', {
      price: 25,
      currency: 'USD',
      marketplaceSpecific: { ...validSetup, bestOfferAutoAcceptPrice: 18 },
    } as any);

    expect(result.warning).toMatch(/best offer/i);
  });

  it('updateListing retries when the best-offer rejection is hyphenated and not the first error', async () => {
    fetchMock.mockImplementation(async (url: any, opts: any) => {
      const u = String(url);
      if (u.includes('/offer/') && (opts as RequestInit).method === 'PUT') {
        const body = JSON.parse((opts as RequestInit).body as string);
        if (body.listingPolicies?.bestOfferTerms) {
          return new Response(JSON.stringify({ errors: [
            { errorId: 25709, message: 'Invalid value for header Accept-Language.' },
            { errorId: 25103, longMessage: 'Best-Offer is not available for this listing format.' },
          ] }), { status: 400 });
        }
        return new Response('{}', { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.updateListing('listing-1', {
      price: 25,
      currency: 'USD',
      marketplaceSpecific: { ...validSetup, bestOfferAutoAcceptPrice: 18 },
    } as any);

    expect(result.status).toBe('active');
    const putCalls = fetchMock.mock.calls.filter(([u, o]) => String(u).includes('/offer/') && (o as RequestInit).method === 'PUT');
    expect(putCalls).toHaveLength(2);
  });
});

// MIGRATION-PLACEHOLDER: createListing publish result — re-added as a Trading test
// (AddFixedPriceItem → active + ItemID + SKU). Draft mode is gone from the adapter:
// ebay_draft is DB-only at the route now (N1), so createListing always publishes live.

// MIGRATION-PLACEHOLDER: createListing per-category condition snap — re-added as a
// Trading test asserting the numeric <ConditionID> reflects selectValidEbayCondition.

describe('EbayAdapter.updateListing — per-category condition auto-correct', () => {
  it('snaps condition to a category-valid grade on update (same 25021 guard as publish)', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('get_item_condition_policies')) {
        return new Response(JSON.stringify({
          itemConditionPolicies: [{ itemConditions: ['1000', '1500', '2500', '3000', '7000'].map((id) => ({ conditionId: id })) }],
        }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('listing-1', {
      ebaySku: 'portage-sku-1',
      condition: 'good',
      marketplaceSpecific: { categoryId: '119018' },
    } as any);
    const putCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/inventory_item/'));
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.condition).toBe('USED_EXCELLENT'); // not USED_GOOD (5000), which 119018 rejects
  });
});

// MIGRATION-PLACEHOLDER: createListing SKU passthrough — re-added as a Trading test
// (provided items.ebaySku rides into <SKU> and round-trips on the result). The offer
// reuse / ebayOfferId concept is gone — Trading AddFixedPriceItem is a single call.

// MIGRATION-PLACEHOLDER: eBay request() error sanitization (longMessage surfacing +
// HTML/XSS strip + non-JSON fallback) — re-added against a still-REST method
// (the metadata pre-flight) with tradingSetup so it reaches request().

describe('selectValidEbayCondition — per-category condition auto-correct', () => {
  it('keeps the static default grade when the category supports it', () => {
    // good → USED_GOOD (5000); a general used category offers 5000
    expect(selectValidEbayCondition('good', ['1000', '3000', '5000', '6000']))
      .toEqual({ condition: 'USED_GOOD', conditionId: '5000' });
  });

  it('falls back to the generic Used grade (3000) when the exact grade is unsupported', () => {
    // good → 5000 not offered; a general category {1000,3000} resolves to USED_EXCELLENT
    expect(selectValidEbayCondition('good', ['1000', '3000']))
      .toEqual({ condition: 'USED_EXCELLENT', conditionId: '3000' });
  });

  it('selects the granular media grade (LIKE_NEW/2750) when the category offers it', () => {
    expect(selectValidEbayCondition('like_new', ['2750', '3000', '4000', '5000']))
      .toEqual({ condition: 'LIKE_NEW', conditionId: '2750' });
  });

  it('maps a new item to NEW (1000) when supported', () => {
    expect(selectValidEbayCondition('new', ['1000', '1500', '3000']))
      .toEqual({ condition: 'NEW', conditionId: '1000' });
  });

  it('never auto-upgrades a used item to NEW — returns null for a NEW-only category', () => {
    expect(selectValidEbayCondition('good', ['1000'])).toBeNull();
  });

  it('returns null for an empty supported list (Metadata API unavailable)', () => {
    expect(selectValidEbayCondition('good', [])).toBeNull();
  });

  it('returns null for an unknown Portage condition', () => {
    expect(selectValidEbayCondition('mystery', ['1000', '3000'])).toBeNull();
  });
});

describe('EbayAdapter.getValidConditions — Metadata API condition policies', () => {
  it('returns the conditionIds a category supports', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      itemConditionPolicies: [{
        categoryId: '15032',
        categoryTreeId: '0',
        itemConditionRequired: true,
        itemConditions: [
          { conditionId: '1000', conditionDescription: 'New' },
          { conditionId: '3000', conditionDescription: 'Used' },
        ],
      }],
      warnings: [],
    }), { status: 200 }));

    expect(await EbayAdapter.getValidConditions('15032')).toEqual(['1000', '3000']);
  });

  it('calls the EBAY_US condition-policies endpoint with a URL-encoded category filter', async () => {
    await EbayAdapter.getValidConditions('15032');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies');
    expect(url).toContain('filter=categoryIds%3A%7B15032%7D');
  });

  it('returns [] when the Metadata API responds non-OK (never blocks prepare)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 404 }));
    expect(await EbayAdapter.getValidConditions('15032')).toEqual([]);
  });

  it('returns [] when the response has no condition policies', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ itemConditionPolicies: [] }), { status: 200 }));
    expect(await EbayAdapter.getValidConditions('15032')).toEqual([]);
  });
});

describe('eBay taxonomy TTL caches', () => {
  it('serves getValidConditions from cache within the TTL — one upstream fetch for two calls', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      itemConditionPolicies: [{ itemConditions: [{ conditionId: '1000' }, { conditionId: '3000' }] }],
    }), { status: 200 }));

    expect(await EbayAdapter.getValidConditions('424242')).toEqual(['1000', '3000']);
    expect(await EbayAdapter.getValidConditions('424242')).toEqual(['1000', '3000']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves getRequiredAspects from cache within the TTL — one upstream fetch for two calls', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      aspects: [{
        localizedAspectName: 'Brand',
        aspectConstraint: { aspectRequired: true, itemToAspectCardinality: 'SINGLE' },
      }],
    }), { status: 200 }));

    const expected = { Brand: { required: true, values: null, cardinality: 'SINGLE' } };
    expect(await EbayAdapter.getRequiredAspects('424242')).toEqual(expected);
    expect(await EbayAdapter.getRequiredAspects('424242')).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('expires the conditions cache after its 1h TTL — a stale entry is refetched', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({
        itemConditionPolicies: [{ itemConditions: [{ conditionId: '1000' }] }],
      }), { status: 200 }));

      expect(await EbayAdapter.getValidConditions('616161')).toEqual(['1000']);
      vi.advanceTimersByTime(60 * 60 * 1000 + 1); // 1h TTL + 1ms
      expect(await EbayAdapter.getValidConditions('616161')).toEqual(['1000']);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never caches a failed response — a transient error must not poison the cache', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('eBay down', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        itemConditionPolicies: [{ itemConditions: [{ conditionId: '1000' }] }],
      }), { status: 200 }));

    expect(await EbayAdapter.getValidConditions('535353')).toEqual([]); // fail-open, NOT cached
    expect(await EbayAdapter.getValidConditions('535353')).toEqual(['1000']); // refetched
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('resolveEbayCategoryId — self-healing leaf category for publish', () => {
  it('resolves by priority: explicit field > item cache > Taxonomy API (explicit/cache skip the API)', async () => {
    const spy = vi.spyOn(EbayAdapter, 'getCategorySuggestion')
      .mockResolvedValue({ categoryId: '111422', categoryName: 'Laptops' });

    // 1. an explicit categoryId on the listing wins and never calls the API (user/listing intent preserved)
    const explicit = await resolveEbayCategoryId({ categoryId: '177' }, { title: 'X', marketplaceData: null });
    expect(explicit.categoryId).toBe('177');
    expect(explicit.newlyResolved).toBe(false);

    // 2. fall back to the item's cached marketplaceData.ebay.categoryId
    const cached = await resolveEbayCategoryId(undefined, { title: 'X', marketplaceData: { ebay: { categoryId: '9355' } } });
    expect(cached.categoryId).toBe('9355');
    expect(cached.newlyResolved).toBe(false);

    expect(spy).not.toHaveBeenCalled();

    // 3. resolve live via Taxonomy API when no categoryId anywhere → flagged for persistence
    const resolved = await resolveEbayCategoryId(undefined, { title: 'Apple MacBook Pro 16', marketplaceData: null });
    expect(resolved.categoryId).toBe('111422');
    expect(resolved.categoryName).toBe('Laptops');
    expect(resolved.newlyResolved).toBe(true);
    expect(spy).toHaveBeenCalledWith('Apple MacBook Pro 16');
  });
});

describe('EbayAdapter.getOrders — creationdate range filter', () => {
  it('builds a valid open-ended creationdate range that closes with ] (not })', async () => {
    const adapter = new EbayAdapter('user-1');
    const since = new Date('2026-05-06T13:43:26.945Z');

    await adapter.getOrders(since);

    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(url).toContain('creationdate:[2026-05-06T13:43:26.945Z..]');
    expect(url).not.toContain('..}');
  });
});

describe('resolveEbayCategoryCondition — auto-correct decision + warning policy', () => {
  it('overrides to the supported grade and warns when it differs from the default', () => {
    // good default = USED_GOOD (5000); a category offering only {1000,3000}
    // forces a fall back to USED_EXCELLENT, which the user should know about.
    const r = resolveEbayCategoryCondition('good', ['1000', '3000']);
    expect(r.condition).toBe('USED_EXCELLENT');
    expect(r.warning).toMatch(/USED_EXCELLENT/);
  });

  it('does nothing (no override, no warning) when the supported list is empty', () => {
    // Metadata API unavailable → keep the static default silently
    expect(resolveEbayCategoryCondition('good', [])).toEqual({});
  });

  it('warns without overriding when no supported grade matches (e.g. used item, NEW-only category)', () => {
    const r = resolveEbayCategoryCondition('good', ['1000']);
    expect(r.condition).toBeUndefined();
    expect(r.warning).toMatch(/doesn't offer/);
  });

  it('sets the condition but stays silent when the supported grade equals the default', () => {
    // good default = USED_GOOD (5000); category offers it → no deviation, no warning
    expect(resolveEbayCategoryCondition('good', ['5000', '3000', '6000']))
      .toEqual({ condition: 'USED_GOOD' });
  });
});

describe('EbayAdapter — Account API business-policy creation (auto-setup)', () => {
  // These are per-seller writes, so they go through this.request() (the seller's
  // OAuth user token, which carries the sell.account scope) — NOT the static
  // app-token methods used for public catalog reads. Each returns the new policy id.

  it('createFulfillmentPolicy POSTs a 1-day-handling CALCULATED USPSParcel buyer-paid policy and returns its id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ fulfillmentPolicyId: 'fp-new' }), { status: 201 }));

    const adapter = new EbayAdapter('user-1');
    const id = await adapter.createFulfillmentPolicy('Portage Standard Fulfillment');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sell/account/v1/fulfillment_policy');
    expect((opts as RequestInit).method).toBe('POST');

    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.name).toBe('Portage Standard Fulfillment');
    expect(body.marketplaceId).toBe('EBAY_US');
    expect(body.categoryTypes).toEqual([{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }]);
    expect(body.handlingTime).toEqual({ value: 1, unit: 'DAY' });
    expect(body.shippingOptions[0].optionType).toBe('DOMESTIC');
    // CALCULATED + USPSParcel: buyer pays the exact computed rate (needs item
    // packageWeightAndSize, now captured). A live probe proved the earlier
    // LOGISTICS_INFO_IS_MISSING was a bad service code (USPSGround →
    // NOT_VALID_FOR_SELLING, USPSGroundAdvantage → UNKNOWN), not a rate-table gap.
    expect(body.shippingOptions[0].costType).toBe('CALCULATED');
    const svc = body.shippingOptions[0].shippingServices[0];
    expect(svc.shippingCarrierCode).toBe('USPS');
    expect(svc.shippingServiceCode).toBe('USPSParcel');
    // No freeShipping/shippingCost — calculated computes the buyer-paid rate.
    expect(svc.freeShipping).toBeUndefined();
    expect(svc.shippingCost).toBeUndefined();

    expect(id).toBe('fp-new');
  });

  it('updateFulfillmentPolicy PUTs the same CALCULATED USPSParcel body to the policy-id path (migrate a stale FLAT_RATE policy in place)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ fulfillmentPolicyId: 'fp-existing' }), { status: 200 }));

    const adapter = new EbayAdapter('user-1');
    const id = await adapter.updateFulfillmentPolicy('fp-existing', 'Portage Standard Fulfillment');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sell/account/v1/fulfillment_policy/fp-existing');
    expect((opts as RequestInit).method).toBe('PUT');

    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.name).toBe('Portage Standard Fulfillment');
    expect(body.shippingOptions[0].costType).toBe('CALCULATED');
    expect(body.shippingOptions[0].shippingServices[0].shippingServiceCode).toBe('USPSParcel');
    // eBay's PUT (full replace) requires globalShipping explicitly — POST defaults
    // it, but a PUT without it fails with 20403 "Global shipping field is null".
    expect(body.globalShipping).toBe(false);

    expect(id).toBe('fp-existing');
  });

  it('createPaymentPolicy POSTs a managed-payments immediate-pay policy (no offline methods) and returns its id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ paymentPolicyId: 'pp-new' }), { status: 201 }));

    const adapter = new EbayAdapter('user-1');
    const id = await adapter.createPaymentPolicy('Portage Standard Payment');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sell/account/v1/payment_policy');
    expect((opts as RequestInit).method).toBe('POST');

    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.name).toBe('Portage Standard Payment');
    expect(body.marketplaceId).toBe('EBAY_US');
    expect(body.categoryTypes).toEqual([{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }]);
    expect(body.immediatePay).toBe(true);
    // eBay Managed Payments controls electronic methods — no offline paymentMethods needed.
    expect(body.paymentMethods).toBeUndefined();

    expect(id).toBe('pp-new');
  });

  it('createReturnPolicy POSTs a 30-day, buyer-paid, money-back policy and returns its id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ returnPolicyId: 'rp-new' }), { status: 201 }));

    const adapter = new EbayAdapter('user-1');
    const id = await adapter.createReturnPolicy('Portage Standard Return');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sell/account/v1/return_policy');
    expect((opts as RequestInit).method).toBe('POST');

    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.name).toBe('Portage Standard Return');
    expect(body.marketplaceId).toBe('EBAY_US');
    expect(body.categoryTypes).toEqual([{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }]);
    expect(body.returnsAccepted).toBe(true);
    expect(body.returnPeriod).toEqual({ value: 30, unit: 'DAY' });
    expect(body.returnShippingCostPayer).toBe('BUYER');
    expect(body.refundMethod).toBe('MONEY_BACK');

    expect(id).toBe('rp-new');
  });
});

describe('EbayAdapter.updateListing — syncs inventory_item + offer', () => {
  it('PUTs the inventory_item when ebaySku is provided, and uses ebayOfferId for the offer', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('listing-id-999', {
      title: 'Updated Headphones',
      description: 'Updated description',
      price: 149,
      currency: 'USD',
      condition: 'good',
      quantity: 5,
      photos: [{ url: 'https://portage-images.digitalharmonyai.com/updated.jpg' }],
      brand: 'Sony',
      model: 'XM5',
      mpn: 'WH1000XM5/B',
      ebaySku: 'portage-sku-abc',
      ebayOfferId: 'offer-42',
    });

    const inventoryPut = fetchMock.mock.calls.find(([u]) => String(u).includes('/inventory_item/portage-sku-abc'));
    expect(inventoryPut).toBeTruthy();
    const invBody = JSON.parse((inventoryPut![1] as RequestInit).body as string);
    expect(invBody.condition).toBe('USED_GOOD');
    expect(invBody.availability.shipToLocationAvailability.quantity).toBe(5);
    expect(invBody.product.title).toBe('Updated Headphones');
    expect(invBody.product.imageUrls).toEqual(['https://portage-images.digitalharmonyai.com/updated.jpg']);
    expect(invBody.product.brand).toBe('Sony');
    // MPN is the real part number (input.mpn), never the model name.
    expect(invBody.product.mpn).toBe('WH1000XM5/B');

    const offerPut = fetchMock.mock.calls.find(([u]) => String(u).includes('/offer/offer-42'));
    expect(offerPut).toBeTruthy();
    const offerBody = JSON.parse((offerPut![1] as RequestInit).body as string);
    expect(offerBody.listingDescription).toBe('Updated description');
    expect(offerBody.pricingSummary.price.value).toBe('149');
  });
});

describe('EbayAdapter.updateListing — packageWeightAndSize', () => {
  it('sends weight and dimensions but omits packageType (symmetry with createListing — eBay rejects unsupported packageType, error 25101)', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('listing-id-999', {
      condition: 'good',
      ebaySku: 'portage-sku-abc',
      ebayOfferId: 'offer-42',
      marketplaceSpecific: {
        weight: { value: 8, unit: 'OUNCE' },
        dimensions: { length: 8, width: 6, height: 4, unit: 'INCH' },
        packageType: 'MAILING_BOX',
      },
    });

    const inventoryPut = fetchMock.mock.calls.find(([u]) => String(u).includes('/inventory_item/portage-sku-abc'));
    expect(inventoryPut).toBeTruthy();
    const invBody = JSON.parse((inventoryPut![1] as RequestInit).body as string);
    expect(invBody.packageWeightAndSize.weight).toEqual({ value: 8, unit: 'OUNCE' });
    expect(invBody.packageWeightAndSize.dimensions).toEqual({ length: 8, width: 6, height: 4, unit: 'INCH' });
    expect(invBody.packageWeightAndSize.packageType).toBeUndefined();
  });
});

describe('EbayAdapter.updateListing — skips empty offer PUT', () => {
  it('does not PUT to the offer endpoint when no title, price, or description changed', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('listing-id-999', {
      condition: 'good',
      quantity: 3,
      ebaySku: 'portage-sku-abc',
      ebayOfferId: 'offer-42',
    });

    const offerPut = fetchMock.mock.calls.find(([u]) => String(u).includes('/offer/offer-42'));
    expect(offerPut).toBeUndefined();
  });
});

describe('EbayAdapter.bulkPublishOffers — batch publish up to 25 offers', () => {
  it('POSTs to bulk_publish_offer and returns per-offer results', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      responses: [
        { statusCode: 200, offerId: 'offer-1', listingId: '110001' },
        { statusCode: 200, offerId: 'offer-2', listingId: '110002' },
        { statusCode: 400, offerId: 'offer-3', errors: [{ message: 'Policy missing' }] },
      ],
    }), { status: 200 }));

    const adapter = new EbayAdapter('user-1');
    const results = await adapter.bulkPublishOffers(['offer-1', 'offer-2', 'offer-3']);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sell/inventory/v1/bulk_publish_offer');
    expect((opts as RequestInit).method).toBe('POST');
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.requests).toEqual([
      { offerId: 'offer-1' },
      { offerId: 'offer-2' },
      { offerId: 'offer-3' },
    ]);

    expect(results).toEqual([
      { offerId: 'offer-1', listingId: '110001', success: true },
      { offerId: 'offer-2', listingId: '110002', success: true },
      { offerId: 'offer-3', listingId: undefined, success: false, error: 'Policy missing' },
    ]);
  });
});

describe('EbayAdapter.createInventoryLocation — Inventory API location (auto-setup)', () => {
  it('POSTs an enabled WAREHOUSE location with the seller address to the merchant-location-key path', async () => {
    // createInventoryLocation returns 204 No Content — the merchantLocationKey
    // in the path is the id, so there is no response body to parse.
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const adapter = new EbayAdapter('user-1');
    await adapter.createInventoryLocation(
      'portage-primary',
      { addressLine1: '123 Main St', city: 'Austin', stateOrProvince: 'TX', postalCode: '78701', country: 'US' },
      'Portage Primary Warehouse',
    );

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sell/inventory/v1/location/portage-primary');
    expect((opts as RequestInit).method).toBe('POST');

    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.location.address).toEqual({
      addressLine1: '123 Main St',
      city: 'Austin',
      stateOrProvince: 'TX',
      postalCode: '78701',
      country: 'US',
    });
    expect(body.name).toBe('Portage Primary Warehouse');
    expect(body.merchantLocationStatus).toBe('ENABLED');
    expect(body.locationTypes).toEqual(['WAREHOUSE']);
  });

  it('rejects a merchantLocationKey containing characters invalid for a URL path segment', async () => {
    const adapter = new EbayAdapter('user-1');
    await expect(
      adapter.createInventoryLocation('invalid key!@#', { country: 'US' }),
    ).rejects.toThrow(/merchantLocationKey/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('EbayAdapter.getFulfillmentPolicy — CALCULATED shipping detection', () => {
  it('returns true for CALCULATED, false for FLAT_RATE, and caches per instance', async () => {
    let calcCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/sell/account/v1/fulfillment_policy/calc')) {
        calcCalls++;
        return new Response(JSON.stringify({ shippingOptions: [{ optionType: 'DOMESTIC', costType: 'CALCULATED' }] }), { status: 200 });
      }
      if (url.includes('/sell/account/v1/fulfillment_policy/flat')) {
        return new Response(JSON.stringify({ shippingOptions: [{ optionType: 'DOMESTIC', costType: 'FLAT_RATE' }] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    expect(await adapter.getFulfillmentPolicy('calc')).toBe(true);
    expect(await adapter.getFulfillmentPolicy('flat')).toBe(false);
    // cached — a repeat lookup issues no new request
    expect(await adapter.getFulfillmentPolicy('calc')).toBe(true);
    expect(calcCalls).toBe(1);
  });
});

describe('EbayAdapter.createListing — inline-shipping data guard (Trading)', () => {
  it('throws EbayWeightRequiredError when weight or dims are missing/zero, before any AddFixedPriceItem call', async () => {
    const adapter = new EbayAdapter('user-1');
    // origin ZIP present, but no weight/dims
    await expect(
      adapter.createListing({ ...baseInput, marketplaceSpecific: { categoryId: '15032', originPostalCode: '10001' } } as any),
    ).rejects.toBeInstanceOf(EbayWeightRequiredError);
    // zero-valued dimension is not a real dimension — must also gate
    await expect(
      adapter.createListing({
        ...baseInput,
        marketplaceSpecific: { categoryId: '15032', originPostalCode: '10001', weight: { value: 56, unit: 'OUNCE' }, dimensions: { length: 0, width: 8, height: 4 } },
      } as any),
    ).rejects.toBeInstanceOf(EbayWeightRequiredError);
    expect(fetchMock.mock.calls.find(([u]) => isTradingCall(u))).toBeUndefined();
  });
});

describe('EbayAdapter.withdrawOffer — end a published eBay offer', () => {
  it('POSTs to the offer withdraw endpoint (not DELETE) for a published listing', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ listingId: '307022338248' }), { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    await adapter.withdrawOffer('193511711011');
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/sell/inventory/v1/offer/193511711011/withdraw'));
    expect(call, 'withdraw endpoint should be hit').toBeDefined();
    expect((call?.[1] as { method?: string })?.method).toBe('POST');
  });
});

describe('EbayAdapter.getEbayItemVerification — F-GATE read-back of live eBay state', () => {
  it('reads the inventory_item + offer for a SKU and returns aspects.MPN, offerId and status', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/inventory_item/PRT-000009')) {
        return new Response(JSON.stringify({
          sku: 'PRT-000009',
          product: {
            title: 'Sennheiser HD 600',
            brand: 'Sennheiser',
            mpn: 'HD600',
            aspects: { Brand: ['Sennheiser'], MPN: ['HD600'], Type: ['Over-Ear'] },
          },
        }), { status: 200 });
      }
      if (u.includes('/offer?sku=PRT-000009')) {
        return new Response(JSON.stringify({
          offers: [{ offerId: '9988776655', status: 'UNPUBLISHED', listing: { listingId: '307019237500' }, pricingSummary: { price: { value: '349.00', currency: 'USD' } } }],
        }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.getEbayItemVerification('PRT-000009');

    expect(result.found).toBe(true);
    expect(result.sku).toBe('PRT-000009');
    expect(result.price).toBe('349.00');
    expect(result.aspects.MPN).toEqual(['HD600']);
    expect(result.mpn).toBe('HD600');
    expect(result.brand).toBe('Sennheiser');
    expect(result.offerId).toBe('9988776655');
    expect(result.status).toBe('UNPUBLISHED');
    expect(result.listingId).toBe('307019237500');
  });

  it('returns found:false with null fields when the inventory_item does not exist (404)', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/inventory_item/')) {
        return new Response(JSON.stringify({ errors: [{ errorId: 25001, message: 'not found' }] }), { status: 404 });
      }
      return new Response(JSON.stringify({ offers: [] }), { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.getEbayItemVerification('PRT-NOPE');

    expect(result.found).toBe(false);
    expect(result.aspects).toEqual({});
    expect(result.mpn).toBeNull();
    expect(result.offerId).toBeNull();
  });
});

describe('EbayAdapter.getTrafficReport — Analytics traffic for a listing', () => {
  it('maps header metric keys to the listing record metric values', async () => {
    const adapter = new EbayAdapter('user-1');
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      header: {
        dimensionKeys: [{ key: 'LISTING' }],
        metrics: [
          { key: 'LISTING_IMPRESSION_TOTAL' },
          { key: 'CLICK_THROUGH_RATE' },
          { key: 'LISTING_VIEWS_TOTAL' },
          { key: 'TRANSACTION' },
          { key: 'SALES_CONVERSION_RATE' },
        ],
      },
      records: [
        {
          dimensionValues: [{ value: '307022338248' }],
          metricValues: [{ value: 1500 }, { value: 2.4 }, { value: 36 }, { value: 3 }, { value: 8.3 }],
        },
      ],
    }), { status: 200 }));

    const report = await adapter.getTrafficReport('307022338248');

    expect(report).toEqual({
      listingId: '307022338248',
      impressions: 1500,
      clickThroughRate: 2.4,
      views: 36,
      transactions: 3,
      salesConversionRate: 8.3,
      range: { from: expect.any(String), to: expect.any(String) },
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/sell/analytics/v1/traffic_report');
    expect(decodeURIComponent(url)).toContain('listing_ids:{307022338248}');
  });
});

describe('resolveEbayConditionId (numeric ConditionID for Trading API)', () => {
  it('resolves a numeric id: explicit conditionId wins, then enum reverse-map, then chain default', () => {
    expect(resolveEbayConditionId('good', { conditionId: '2750' })).toBe('2750');
    expect(resolveEbayConditionId('good', { condition: 'LIKE_NEW' })).toBe('2750');
    expect(resolveEbayConditionId('good')).toBe('5000');
    expect(resolveEbayConditionId('new')).toBe('1000');
    expect(resolveEbayConditionId('unknown-grade')).toBe('3000');
  });
});
