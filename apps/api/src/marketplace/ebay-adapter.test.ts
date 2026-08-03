import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadEnv } from '../lib/env.js';
import { AppError } from '../middleware/error.js';
import { resolveEbayCondition, resolveEbayConditionId, selectValidEbayCondition, resolveEbayCategoryCondition, resolveEbayCategoryId, EbayAdapter, EbayWeightRequiredError, clearEbayTaxonomyCaches } from './ebay-adapter.js';

vi.mock('./token-manager.js', () => ({
  getEbayAccessToken: vi.fn().mockResolvedValue('test-token'),
  getEbayProdAppToken: vi.fn().mockResolvedValue('test-app-token'),
  invalidateEbayProdAppToken: vi.fn(),
}));

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

describe('EbayAdapter.createListing — condition notes fallback', () => {
  // The item's stored conditionNotes never reached eBay on publish paths that
  // skip prepare-listing (quick list, photo-first, seeded drafts): the builder
  // only read marketplaceSpecific.conditionDescription, which only the AI
  // prepare flow populates. The notes are the fallback, never the override —
  // a prepared (user-reviewed) conditionDescription still wins.
  it('sends item conditionNotes as ConditionDescription when no prepared conditionDescription exists', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      conditionNotes: 'Light scratches on the back panel.',
      marketplaceSpecific: { ...tradingSetup },
    } as any);
    const xml = tradingXml();
    expect(xml).toContain('<ConditionDescription>Light scratches on the back panel.</ConditionDescription>');
  });
});

// NOTE: createListing aspect/gate coverage is being re-expressed against the Trading
// AddFixedPriceItem XML below (ITEM-SPECIFICS-MIGRATION marker). The Inventory-API
// product.aspects-JSON versions were removed — that behavior no longer exists.
describe('EbayAdapter.createListing — aspect backfill + normalization (Trading)', () => {
  it('backfills MPN "Does Not Apply" for a branded item with no real mpn, and coerces string/number aspect values', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput, brand: 'Sony',
      marketplaceSpecific: { ...tradingSetup, aspects: { 'Form Factor': 'Shotgun', 'Number of Channels': 2 } },
    } as any);
    const xml = tradingXml();
    expect(xml).toContain('<Name>Brand</Name><Value>Sony</Value>');
    expect(xml).toContain('<Name>MPN</Name><Value>Does Not Apply</Value>');
    // single-string and numeric AI values coerce to string array, not crash/vanish
    expect(xml).toContain('<Name>Form Factor</Name><Value>Shotgun</Value>');
    expect(xml).toContain('<Name>Number of Channels</Name><Value>2</Value>');
  });
});

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

describe('EbayAdapter.createListing — Best Offer auto-accept', () => {
  it('retries AddFixedPriceItem without Best Offer when eBay rejects it for that reason, and surfaces a downgrade warning', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: unknown, opts: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      calls++;
      const body = String((opts as RequestInit).body);
      if (body.includes('BestOfferAutoAcceptPrice')) {
        return new Response('<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Best Offer is not supported for this category.</ShortMessage></Errors></AddFixedPriceItemResponse>', { status: 200 });
      }
      return new Response(ADD_ITEM_OK, { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const result = await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: { ...tradingSetup, bestOfferAutoAcceptPrice: 18 },
    } as any);
    expect(calls).toBe(2); // first with Best Offer (rejected), retry without
    expect(result.status).toBe('active');
    expect(result.warning).toMatch(/best offer/i);
  });

  it('maps bestOfferEnabled + minimumBestOfferPrice from marketplaceSpecific into the Add XML', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: { ...tradingSetup, bestOfferEnabled: true, minimumBestOfferPrice: 10 },
    } as any);
    const addCall = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    const body = String((addCall![1] as RequestInit).body);
    expect(body).toContain('<BestOfferEnabled>true</BestOfferEnabled>');
    expect(body).toContain('<MinimumBestOfferPrice currencyID="USD">10</MinimumBestOfferPrice>');
  });

  it('downgrade-retries a toggle-only (no floor) Best Offer rejection as well', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: unknown, opts: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      calls++;
      const body = String((opts as RequestInit).body);
      if (body.includes('<BestOfferEnabled>true</BestOfferEnabled>')) {
        return new Response('<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Best Offer is not supported for this category.</ShortMessage></Errors></AddFixedPriceItemResponse>', { status: 200 });
      }
      return new Response(ADD_ITEM_OK, { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const result = await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: { ...tradingSetup, bestOfferEnabled: true },
    } as any);
    expect(calls).toBe(2);
    expect(result.status).toBe('active');
    expect(result.warning).toMatch(/best offer/i);
  });

  it('surfaces a threshold-conflict code at publish as 422 BEST_OFFER_CONFLICT — config is never silently dropped (BO-2)', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      calls++;
      return new Response('<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Invalid AutoAccept price.</ShortMessage><ErrorCode>23004</ErrorCode></Errors></AddFixedPriceItemResponse>', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const err = await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: { ...tradingSetup, bestOfferAutoAcceptPrice: 500 },
    } as any).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('BEST_OFFER_CONFLICT');
    expect(calls).toBe(1); // no downgrade — the seller fixes the numbers
  });

  it('does NOT retry when the rejection is unrelated to Best Offer — the real error surfaces', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url)
        ? new Response('<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>A required item specific is missing.</ShortMessage></Errors></AddFixedPriceItemResponse>', { status: 200 })
        : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    await expect(adapter.createListing({
      ...baseInput,
      marketplaceSpecific: { ...tradingSetup, bestOfferAutoAcceptPrice: 18 },
    } as any)).rejects.toThrow(/required item specific/i);
  });

});

describe('EbayAdapter.promoteListing — Promoted Listings Standard', () => {
  it('reuses an existing Portage CPS campaign and creates the ad by listing id', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    fetchMock.mockImplementation(async (url: unknown, init?: unknown) => {
      const u = String(url);
      calls.push({ url: u, init: init as RequestInit });
      if (u.includes('/sell/marketing/v1/ad_campaign?')) {
        return new Response(JSON.stringify({ campaigns: [{ campaignId: 'C123', campaignName: 'Portage Promoted Listings', fundingStrategy: { fundingModel: 'COST_PER_SALE' } }] }), { status: 200 });
      }
      if (u.endsWith('/sell/marketing/v1/ad_campaign/C123/ad')) {
        return new Response(JSON.stringify({ adId: 'AD1' }), { status: 201 });
      }
      return new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    await adapter.promoteListing('307000000001', 5);
    const adCall = calls.find((c) => c.url.endsWith('/ad_campaign/C123/ad'))!;
    expect(adCall).toBeTruthy();
    expect(JSON.parse(String(adCall.init!.body))).toEqual({ listingId: '307000000001', bidPercentage: '5.0' });
  });
});

describe('EbayAdapter.createListing — publish result (Trading)', () => {
  it('returns active + the AddFixedPriceItem ItemID + SKU on a successful publish', async () => {
    const adapter = new EbayAdapter('user-1');
    const result = await adapter.createListing({
      ...baseInput, ebaySku: 'PRT-000042',
      marketplaceSpecific: { ...tradingSetup },
    } as any);
    expect(result.status).toBe('active');
    expect(result.marketplaceListingId).toBe('3001234567'); // ItemID from ADD_ITEM_OK
    expect(result.marketplaceUrl).toContain('3001234567');
    expect(result.ebaySku).toBe('PRT-000042');
  });
});

describe('EbayAdapter.createListing — per-category condition snap (Trading)', () => {
  it('snaps "good" to the closest grade the category accepts, as a numeric ConditionID', async () => {
    // cat 119018 accepts {1000,1500,2500,3000,7000} — NOT 5000 (USED_GOOD); chain → 3000
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('get_item_condition_policies')) {
        return new Response(JSON.stringify({
          itemConditionPolicies: [{ itemConditions: ['1000', '1500', '2500', '3000', '7000'].map((id) => ({ conditionId: id })) }],
        }), { status: 200 });
      }
      return isTradingCall(url) ? new Response(ADD_ITEM_OK, { status: 200 }) : new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput, condition: 'good',
      marketplaceSpecific: { ...tradingSetup, categoryId: '119018' },
    } as any);
    expect(tradingXml()).toContain('<ConditionID>3000</ConditionID>'); // not 5000
  });
});

// SKU passthrough is covered by the "publish result" test above (asserts ebaySku
// 'PRT-000042' rides through and round-trips). The offer-reuse / ebayOfferId concept
// is gone — Trading AddFixedPriceItem is a single call.
//
// request() error sanitization (longMessage + HTML/XSS strip + non-JSON fallback) is
// UNCHANGED code; createListing no longer exercises request() on the publish path
// (it uses callTradingApi). That coverage belongs with a REST method and is re-added
// with the updateListing rewrite (Phase 4), which uses request() throughout.

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

  it('maps orderFulfillmentStatus FULFILLED to fulfillmentStatus "shipped" (others "unshipped")', async () => {
    const order = (orderId: string, orderFulfillmentStatus: string) => ({
      orderId,
      orderFulfillmentStatus,
      creationDate: '2026-06-10T00:00:00.000Z',
      buyer: { username: 'buyer1' },
      pricingSummary: { total: { value: '100.00', currency: 'USD' }, deliveryCost: { value: '5.00' } },
      lineItems: [{ legacyItemId: '3001', title: 'Pedal' }],
    });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      orders: [order('o-1', 'FULFILLED'), order('o-2', 'NOT_STARTED'), order('o-3', 'IN_PROGRESS')],
    }), { status: 200 }));
    const adapter = new EbayAdapter('user-1');

    const results = await adapter.getOrders();

    // Without this signal every synced order lands as "needs shipping" even
    // when the seller shipped it on eBay long ago.
    expect(results.map(r => r.fulfillmentStatus)).toEqual(['shipped', 'unshipped', 'unshipped']);
  });

  it('maps cancelStatus CANCELED to fulfillmentStatus "canceled" — even over FULFILLED', async () => {
    // Live case 26-14725-05164: NOT_STARTED + FULLY_REFUNDED + CANCELED sat in
    // the ship queue forever because no canceled state existed.
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      orders: [{
        orderId: 'o-c',
        orderFulfillmentStatus: 'FULFILLED',
        cancelStatus: { cancelState: 'CANCELED' },
        creationDate: '2026-06-10T00:00:00.000Z',
        buyer: { username: 'buyer1' },
        pricingSummary: { total: { value: '306.23', currency: 'USD' }, deliveryCost: { value: '0' } },
        lineItems: [{ legacyItemId: '3001', title: 'SSD' }],
      }],
    }), { status: 200 }));
    const adapter = new EbayAdapter('user-1');

    const results = await adapter.getOrders();

    expect(results[0].fulfillmentStatus).toBe('canceled');
  });

  it('pages through results — a seller with >50 orders is not silently truncated', async () => {
    const order = (orderId: string) => ({
      orderId,
      orderFulfillmentStatus: 'FULFILLED',
      creationDate: '2026-06-10T00:00:00.000Z',
      buyer: { username: 'buyer1' },
      pricingSummary: { total: { value: '10.00', currency: 'USD' }, deliveryCost: { value: '0' } },
      lineItems: [{ legacyItemId: '3001', title: 'X' }],
    });
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('offset=50')) {
        return new Response(JSON.stringify({ orders: [order('o-51')] }), { status: 200 });
      }
      return new Response(JSON.stringify({
        orders: Array.from({ length: 50 }, (_, i) => order(`o-${i + 1}`)),
        next: 'https://api.ebay.com/sell/fulfillment/v1/order?limit=50&offset=50',
      }), { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');

    const results = await adapter.getOrders();

    // The heals can only repair what the fetch returns — a hard 50 cap
    // silently strands every order past the first page.
    expect(results).toHaveLength(51);
    expect(results[50].marketplaceOrderId).toBe('o-51');
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

describe('EbayAdapter.updateListing — Trading Revise dispatch', () => {
  const reviseOk = (call: string) =>
    `<?xml version="1.0"?><${call}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></${call}Response>`;

  it('a price/quantity-only edit goes through ReviseInventoryStatus (no full item body)', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url) ? new Response(reviseOk('ReviseInventoryStatus'), { status: 200 }) : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('307034606520', { price: 199, quantity: 2, currency: 'USD' });

    const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    expect((call?.[1] as RequestInit).headers).toMatchObject({ 'X-EBAY-API-CALL-NAME': 'ReviseInventoryStatus' });
    const body = String((call?.[1] as RequestInit).body);
    expect(body).toContain('<ItemID>307034606520</ItemID>');
    expect(body).toContain('<StartPrice currencyID="USD">199</StartPrice>');
    expect(body).toContain('<Quantity>2</Quantity>');
    expect(body).not.toContain('<Title>'); // not a full content revise
  });

  it('a content edit (title) goes through ReviseFixedPriceItem with the full item body', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url) ? new Response(reviseOk('ReviseFixedPriceItem'), { status: 200 }) : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('307034606520', {
      ...baseInput,
      title: 'Refreshed Title',
      ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup },
    } as any);

    const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    expect((call?.[1] as RequestInit).headers).toMatchObject({ 'X-EBAY-API-CALL-NAME': 'ReviseFixedPriceItem' });
    const body = String((call?.[1] as RequestInit).body);
    expect(body).toContain('<ItemID>307034606520</ItemID>');
    expect(body).toContain('<Title>Refreshed Title</Title>');
    // no Inventory REST PUTs under Trade-First
    expect(fetchMock.mock.calls.find(([u]) => String(u).includes('/sell/inventory/v1/'))).toBeUndefined();
  });

  it('a content revise for a zero-photo item proceeds (omits PictureDetails) and surfaces a warning — price sync must not starve', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url) ? new Response(reviseOk('ReviseFixedPriceItem'), { status: 200 }) : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    const result = await adapter.updateListing('307034606520', {
      ...baseInput,
      title: 'Refreshed Title',
      photos: [],
      price: 149,
      ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup },
    } as any);

    const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    expect((call?.[1] as RequestInit).headers).toMatchObject({ 'X-EBAY-API-CALL-NAME': 'ReviseFixedPriceItem' });
    const body = String((call?.[1] as RequestInit).body);
    expect(body).toContain('<StartPrice');
    expect(body).not.toContain('<PictureDetails>');
    expect(result.warning).toMatch(/existing pictures/i);
  });

  it('snaps condition to a category-valid ConditionID on a content revise (25021 guard, parity with publish)', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('get_item_condition_policies')) {
        return new Response(JSON.stringify({
          itemConditionPolicies: [{ itemConditions: ['1000', '1500', '2500', '3000', '7000'].map((id) => ({ conditionId: id })) }],
        }), { status: 200 });
      }
      return isTradingCall(url) ? new Response(reviseOk('ReviseFixedPriceItem'), { status: 200 }) : new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    await adapter.updateListing('307034606520', {
      ...baseInput, condition: 'good', ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup, categoryId: '119018' },
    } as any);

    const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    expect(String((call?.[1] as RequestInit).body)).toContain('<ConditionID>3000</ConditionID>'); // not 5000
  });

  it('surfaces a category-level Best Offer rejection as 422 BEST_OFFER_UNSUPPORTED — no downgrade retry on updates (BO-2)', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      calls++;
      return new Response('<ReviseFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Best Offer is not supported for this category.</ShortMessage></Errors></ReviseFixedPriceItemResponse>', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const err = await adapter.updateListing('307034606520', {
      ...baseInput, title: 'New', ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup, bestOfferAutoAcceptPrice: 18 },
    } as any).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(422);
    expect((err as AppError).code).toBe('BEST_OFFER_UNSUPPORTED');
    expect(calls).toBe(1); // the seller decides — never auto-stripped on an update
  });
});

describe('EbayAdapter.updateListing — stored Best Offer threshold vs lowered price (23004)', () => {
  it('surfaces 23004 from STORED thresholds as 422 BEST_OFFER_CONFLICT — no DeletedField retry (BO-2, supersedes PR #285)', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      calls++;
      // Live repro: price lowered to the stored auto-accept amount — eBay
      // validates the STORED threshold even when the revise omits the tag.
      return new Response('<ReviseFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Invalid AutoAccept price.</ShortMessage><LongMessage>The Best Offer Auto Accept Price must be less than the Buy It Now price.</LongMessage><ErrorCode>23004</ErrorCode></Errors></ReviseFixedPriceItemResponse>', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const err = await adapter.updateListing('307102403404', {
      ...baseInput, price: 25, ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup, bestOfferEnabled: true, bestOfferAutoAcceptPrice: 25, minimumBestOfferPrice: 20 },
    } as any).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('BEST_OFFER_CONFLICT');
    expect((err as AppError).message).toMatch(/25.*20|20.*25/); // both numbers surfaced
    expect(calls).toBe(1); // seller thresholds never deleted to force the edit
  });
});

describe('EbayAdapter.updateListing — Best Offer threshold conflict (BO-2)', () => {
  it('surfaces eBay 22003/23004 as a typed 422 BEST_OFFER_CONFLICT with the stored thresholds, and never retries with deletion', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      calls++;
      return new Response('<ReviseFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Auto decline amount cannot be greater than or equal to the Buy It Now price.</ShortMessage><ErrorCode>22003</ErrorCode></Errors></ReviseFixedPriceItemResponse>', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const err = await adapter.updateListing('307100136291', {
      ...baseInput, price: 199, title: 'New', ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup, bestOfferEnabled: true, minimumBestOfferPrice: 199, bestOfferAutoAcceptPrice: 209 },
    } as any).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(422);
    expect((err as AppError).code).toBe('BEST_OFFER_CONFLICT');
    expect((err as AppError).message).toMatch(/209|199/); // actionable: carries the conflicting numbers
    expect(calls).toBe(1); // no deletion retry — user config is never destroyed
  });
});

describe('EbayAdapter.getEbayItemVerification — Best Offer read-back (BO-3)', () => {
  it('forwards the live Best Offer state from GetItem for the conflict-time heal', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url)
        ? new Response('<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><Item><ItemID>307100024169</ItemID><BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails><ListingDetails><BestOfferAutoAcceptPrice currencyID="USD">269.0</BestOfferAutoAcceptPrice><MinimumBestOfferPrice currencyID="USD">249.0</MinimumBestOfferPrice></ListingDetails></Item></GetItemResponse>', { status: 200 })
        : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    const v = await adapter.getEbayItemVerification('307100024169');

    expect(v.found).toBe(true);
    expect(v.bestOfferEnabled).toBe(true);
    expect(v.bestOfferAutoAcceptPrice).toBe(269);
    expect(v.minimumBestOfferPrice).toBe(249);
  });
});

describe('EbayAdapter.updateListing — explicit Best Offer disable (BO-4)', () => {
  it('bestOfferEnabled === false sends BestOfferEnabled false plus DeletedField for both thresholds on the FIRST call — the only deletion path, driven by seller intent', async () => {
    let body = '';
    fetchMock.mockImplementation(async (url: unknown, opts: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      body = String((opts as RequestInit).body);
      return new Response('<ReviseFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></ReviseFixedPriceItemResponse>', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const result = await adapter.updateListing('307034606520', {
      ...baseInput, title: 'New', ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup, bestOfferEnabled: false },
    } as any);

    expect(result.status).toBe('active');
    expect(body).toContain('<BestOfferEnabled>false</BestOfferEnabled>');
    expect(body).toContain('<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>');
    expect(body).toContain('<DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>');
  });
});

describe('EbayAdapter.updateListing — category-level rejection, floor-only config (BO-2)', () => {
  it('classifies a floor-only config (enabled + minimum, no auto-accept) as BEST_OFFER_UNSUPPORTED too — no retry', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: unknown) => {
      if (!isTradingCall(url)) return new Response('{}', { status: 200 });
      calls++;
      return new Response('<ReviseFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Best Offer is not supported for this category.</ShortMessage></Errors></ReviseFixedPriceItemResponse>', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');
    const err = await adapter.updateListing('307102403404', {
      ...baseInput, title: 'New', ebaySku: 'PRT-000016',
      marketplaceSpecific: { ...tradingSetup, bestOfferEnabled: true, minimumBestOfferPrice: 20 },
    } as any).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('BEST_OFFER_UNSUPPORTED');
    expect(calls).toBe(1);
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

describe('EbayAdapter — per-listing ebayShipping (beta 17be7322)', () => {
  it('flows specific.ebayShipping (flat) into the Trading XML: Flat type, cost, service, DispatchTimeMax', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: {
        ...tradingSetup,
        ebayShipping: { method: 'flat', flatCost: 6.5, service: 'UPSGround', handlingDays: 3 },
      },
    } as any);
    const body = tradingXml();
    expect(body).toContain('<ShippingType>Flat</ShippingType>');
    expect(body).toContain('<ShippingServiceCost currencyID="USD">6.50</ShippingServiceCost>');
    expect(body).toContain('<ShippingService>UPSGround</ShippingService>');
    expect(body).toContain('<DispatchTimeMax>3</DispatchTimeMax>');
    expect(body).not.toContain('CalculatedShippingRate');
  });

  it('ebayShipping.localPickup adds the Pickup service option alongside the method', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: {
        ...tradingSetup,
        ebayShipping: { method: 'calculated', localPickup: true },
      },
    } as any);
    const body = tradingXml();
    expect(body).toContain('<ShippingService>Pickup</ShippingService>');
    expect(body).toContain('<ShippingType>Calculated</ShippingType>');
  });

  it('skips the weight/dims gate for flat and free methods (calculated-only requirement)', async () => {
    const adapter = new EbayAdapter('user-1');
    // No weight, no dimensions — legacy calculated path would throw EbayWeightRequiredError.
    await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: {
        categoryId: '15032',
        originPostalCode: '10001',
        ebayShipping: { method: 'free' },
      },
    } as any);
    const body = tradingXml();
    expect(body).toContain('<FreeShipping>true</FreeShipping>');
  });

  it('translates stored Inventory package enums into Trading ShippingPackage values (raw pass-through = live error 37)', async () => {
    // items.ebayPackageType stores Inventory-API enums (MAILING_BOX/LETTER/…);
    // Trading takes ShippingPackageCodeType (live GeteBayDetails 2026-08-01:
    // Letter, LargeEnvelope, PackageThickEnvelope, USPSLargePack).
    const cases: Array<[string, string]> = [
      ['MAILING_BOX', 'PackageThickEnvelope'],
      ['PACKAGE_THICK_ENVELOPE', 'PackageThickEnvelope'],
      ['LARGE_ENVELOPE', 'LargeEnvelope'],
      ['LETTER', 'Letter'],
      ['USPS_LARGE_PACKAGE', 'USPSLargePack'],
      ['LARGE_PACKAGE', 'USPSLargePack'],
    ];
    for (const [stored, trading] of cases) {
      fetchMock.mockClear();
      const adapter = new EbayAdapter('user-1');
      await adapter.createListing({
        ...baseInput,
        marketplaceSpecific: { ...tradingSetup, packageType: stored },
      } as any);
      expect(tradingXml(), stored).toContain(`<ShippingPackage>${trading}</ShippingPackage>`);
    }
    // Unknown value: drop it — builder default (PackageThickEnvelope) applies.
    fetchMock.mockClear();
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      marketplaceSpecific: { ...tradingSetup, packageType: 'SOMETHING_NEW' },
    } as any);
    expect(tradingXml()).toContain('<ShippingPackage>PackageThickEnvelope</ShippingPackage>');
  });
});

describe('EbayAdapter.deleteListing — end a live listing via Trading EndFixedPriceItem', () => {
  it('calls EndFixedPriceItem with the ItemID (not an Inventory offer DELETE)', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url)
        ? new Response('<?xml version="1.0"?><EndFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></EndFixedPriceItemResponse>', { status: 200 })
        : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    await adapter.deleteListing('307034606520');

    const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    expect(call, 'a Trading API call should be made').toBeDefined();
    expect((call?.[1] as RequestInit).headers).toMatchObject({ 'X-EBAY-API-CALL-NAME': 'EndFixedPriceItem' });
    expect(String((call?.[1] as RequestInit).body)).toContain('<ItemID>307034606520</ItemID>');
    // never the old Inventory REST offer path (would 404 on a Trading ItemID)
    expect(fetchMock.mock.calls.find(([u]) => String(u).includes('/sell/inventory/v1/offer/'))).toBeUndefined();
  });
});

describe('EbayAdapter.getListingStatus — Trading GetItem status read', () => {
  const getItemXml = (listingStatus: string, qtySold = 0) =>
    `<?xml version="1.0"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><Item><ItemID>307034606520</ItemID><SellingStatus><ListingStatus>${listingStatus}</ListingStatus><QuantitySold>${qtySold}</QuantitySold></SellingStatus></Item></GetItemResponse>`;

  it('maps GetItem ListingStatus=Active to "active" via a GetItem Trading call (not Inventory offer GET)', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url) ? new Response(getItemXml('Active'), { status: 200 }) : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');
    const status = await adapter.getListingStatus('307034606520');

    expect(status).toBe('active');
    const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    expect((call?.[1] as RequestInit).headers).toMatchObject({ 'X-EBAY-API-CALL-NAME': 'GetItem' });
    expect(String((call?.[1] as RequestInit).body)).toContain('<ItemID>307034606520</ItemID>');
    expect(fetchMock.mock.calls.find(([u]) => String(u).includes('/sell/inventory/v1/offer/'))).toBeUndefined();
  });

  it('maps Completed with QuantitySold>0 to "sold" and returns "unknown" on a read error', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url) ? new Response(getItemXml('Completed', 1), { status: 200 }) : new Response('{}', { status: 200 }));
    expect(await new EbayAdapter('user-1').getListingStatus('307034606520')).toBe('sold');

    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));
    expect(await new EbayAdapter('user-1').getListingStatus('307034606520')).toBe('unknown');
  });
});

describe('EbayAdapter.getEbayItemVerification — F-GATE read-back via Trading GetItem', () => {
  it('reads aspects/MPN/Brand/status from GetItem by ItemID (not Inventory inventory_item/offer)', async () => {
    const xml = '<?xml version="1.0"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>'
      + '<Item><ItemID>307019237500</ItemID><SKU>PRT-000009</SKU><SellingStatus><ListingStatus>Active</ListingStatus></SellingStatus>'
      + '<StartPrice currencyID="USD">349</StartPrice><ItemSpecifics>'
      + '<NameValueList><Name>Brand</Name><Value>Sennheiser</Value></NameValueList>'
      + '<NameValueList><Name>MPN</Name><Value>HD600</Value></NameValueList>'
      + '<NameValueList><Name>Type</Name><Value>Over-Ear</Value></NameValueList>'
      + '</ItemSpecifics></Item></GetItemResponse>';
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url) ? new Response(xml, { status: 200 }) : new Response('{}', { status: 200 }));

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.getEbayItemVerification('307019237500');

    expect(result.found).toBe(true);
    expect(result.sku).toBe('PRT-000009');
    expect(result.listingId).toBe('307019237500');
    expect(result.aspects.MPN).toEqual(['HD600']);
    expect(result.mpn).toBe('HD600');
    expect(result.brand).toBe('Sennheiser');
    expect(result.status).toBe('Active');
    const call = fetchMock.mock.calls.find(([u]) => isTradingCall(u));
    expect((call?.[1] as RequestInit).headers).toMatchObject({ 'X-EBAY-API-CALL-NAME': 'GetItem' });
    expect(fetchMock.mock.calls.find(([u]) => String(u).includes('/inventory_item/'))).toBeUndefined();
  });

  it('returns found:false with null fields when GetItem fails (ended/unknown ItemID)', async () => {
    fetchMock.mockImplementation(async () => new Response(
      '<?xml version="1.0"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Item not found</ShortMessage></Errors></GetItemResponse>',
      { status: 200 }));

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.getEbayItemVerification('999');

    expect(result.found).toBe(false);
    expect(result.aspects).toEqual({});
    expect(result.mpn).toBeNull();
    expect(result.listingId).toBeNull();
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

describe('EbayAdapter.getItemDetail — GetItem inventory backfill for orphan orders', () => {
  const GET_ITEM_OK =
    '<?xml version="1.0"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">' +
    '<Ack>Success</Ack><Item><ItemID>306972688941</ItemID><Title>Shure SM7B Microphone</Title>' +
    '<StartPrice currencyID="USD">399</StartPrice>' +
    '<PictureDetails><PictureURL>https://i.ebayimg.com/a.jpg</PictureURL><PictureURL>https://i.ebayimg.com/b.jpg</PictureURL></PictureDetails>' +
    '<ItemSpecifics><NameValueList><Name>Brand</Name><Value>Shure</Value></NameValueList></ItemSpecifics>' +
    '</Item></GetItemResponse>';

  it('returns title, photos, price, brand and aspects from a GetItem response', async () => {
    fetchMock.mockImplementation(async (url: unknown) =>
      isTradingCall(url) ? new Response(GET_ITEM_OK, { status: 200 }) : new Response('{}', { status: 200 }));
    const adapter = new EbayAdapter('user-1');

    const detail = await adapter.getItemDetail('306972688941');

    expect(detail.found).toBe(true);
    expect(detail.title).toBe('Shure SM7B Microphone');
    expect(detail.photos).toEqual(['https://i.ebayimg.com/a.jpg', 'https://i.ebayimg.com/b.jpg']);
    expect(detail.price).toBe(399);
    expect(detail.brand).toBe('Shure');
    expect(detail.aspects.Brand).toEqual(['Shure']);
  });
});

describe('EbayAdapter.getOrders — line-item title for orphan-order backfill', () => {
  it('maps lineItems[0].title onto the order result', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/sell/fulfillment/v1/order')) {
        return new Response(JSON.stringify({ orders: [{
          orderId: '23-14730-30879',
          buyer: { username: 'buyer1' },
          pricingSummary: { total: { value: '399', currency: 'USD' }, deliveryCost: { value: '0' } },
          lineItems: [{ legacyItemId: '306972688941', title: 'Shure SM7B Microphone' }],
        }] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');

    const orders = await adapter.getOrders();

    expect(orders[0].marketplaceListingId).toBe('306972688941');
    expect(orders[0].title).toBe('Shure SM7B Microphone');
  });
});

describe('EbayAdapter.getOrders — sold date from eBay creationDate', () => {
  it('maps Order.creationDate onto soldAt (not the sync time)', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/sell/fulfillment/v1/order')) {
        return new Response(JSON.stringify({ orders: [{
          orderId: '23-14730-30879',
          buyer: { username: 'buyer1' },
          pricingSummary: { total: { value: '399', currency: 'USD' }, deliveryCost: { value: '0' } },
          lineItems: [{ legacyItemId: '306972688941', title: 'Shure SM7B Microphone' }],
          creationDate: '2026-05-04T09:23:19.815Z',
        }] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');

    const orders = await adapter.getOrders();

    expect(orders[0].soldAt).toEqual(new Date('2026-05-04T09:23:19.815Z'));
  });
});

describe('EbayAdapter.getOrders — marketplace fees', () => {
  it('reports 0 fees even when totalFeeBasisAmount is present (fee BASIS, not the fee)', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/sell/fulfillment/v1/order')) {
        return new Response(JSON.stringify({ orders: [{
          orderId: '13-14804-73944',
          buyer: { username: 'buyer1' },
          pricingSummary: { total: { value: '25.00', currency: 'USD' }, deliveryCost: { value: '0' } },
          // Fee BASIS (item + shipping used to CALCULATE fees) — mapping this as
          // the fee produced "Profit −$2.06" on a $25 sale. Real fees come from
          // the Finances API, which we don't call.
          totalFeeBasisAmount: { value: '27.06' },
          lineItems: [{ legacyItemId: '306972688941' }],
          creationDate: '2026-06-23T22:21:00.000Z',
        }] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const adapter = new EbayAdapter('user-1');

    const orders = await adapter.getOrders();

    expect(orders[0].marketplaceFees).toBe(0);
  });
});

describe('EbayAdapter — ebayShipping hardening (review findings 2026-08-02)', () => {
  it('an unknown shipping method still requires weight/dims (falls back to Calculated XML)', async () => {
    const adapter = new EbayAdapter('user-1');
    await expect(
      adapter.createListing({
        ...baseInput,
        marketplaceSpecific: {
          categoryId: '15032', originPostalCode: '10001',
          ebayShipping: { method: 'expedited' }, // not a real method — schema is open
        },
      } as any),
    ).rejects.toBeInstanceOf(EbayWeightRequiredError);
  });
});

describe('EbayAdapter — flat shipping requires a positive cost', () => {
  it('rejects method=flat without flatCost — a $0.00 "Flat" listing masquerades as free', async () => {
    const adapter = new EbayAdapter('user-1');
    await expect(
      adapter.createListing({
        ...baseInput,
        marketplaceSpecific: { ...tradingSetup, ebayShipping: { method: 'flat' } },
      } as any),
    ).rejects.toMatchObject({ code: 'EBAY_FLAT_COST_REQUIRED' });
    expect(fetchMock.mock.calls.find(([u]) => isTradingCall(u))).toBeUndefined();
  });
});
