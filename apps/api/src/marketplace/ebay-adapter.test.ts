import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadEnv } from '../lib/env.js';
import { resolveEbayCondition, validateEbayListingFields, selectValidEbayCondition, resolveEbayCategoryCondition, EbayAdapter } from './ebay-adapter.js';

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

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  loadEnv();
  // Fresh Response per call — a Response body can only be read once, and
  // createListing makes several requests (inventory PUT, offer POST, publish).
  fetchMock = vi.fn().mockImplementation(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
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
      adapter.createListing({ ...baseInput, marketplaceSpecific: { ...validSetup } } as any),
    ).rejects.toThrow(/category/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wires the item quantity into the inventory PUT body', async () => {
    const adapter = new EbayAdapter('user-1');
    await adapter.createListing({
      ...baseInput,
      quantity: 7,
      marketplaceSpecific: { categoryId: '15032', ...validSetup },
    } as any);
    const putCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/inventory_item/'));
    expect(putCall).toBeTruthy();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.availability.shipToLocationAvailability.quantity).toBe(7);
  });
});

describe('EbayAdapter.createListing — draft vs live publish mode', () => {
  it('draft mode creates an unpublished offer and skips the publish call', async () => {
    // The offer POST returns an offerId; the inventory PUT uses the default {} mock.
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/offer') && !u.includes('/publish')) {
        return new Response(JSON.stringify({ offerId: 'offer-123' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.createListing({
      ...baseInput,
      publishMode: 'draft',
      marketplaceSpecific: { categoryId: '15032', ...validSetup },
    } as any);

    // an intentional draft never calls the publish endpoint
    const publishCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/publish'));
    expect(publishCall).toBeUndefined();
    // it surfaces the offer handle + generated SKU and is marked draft (no warning)
    expect(result.status).toBe('draft');
    expect(result.ebayOfferId).toBe('offer-123');
    expect(result.ebaySku).toMatch(/^portage-/);
    expect(result.warning).toBeUndefined();
  });

  it('live mode publishes the offer and returns the listing id, offer id and SKU', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/publish')) {
        return new Response(JSON.stringify({ listingId: '110012345678' }), { status: 200 });
      }
      if (u.includes('/offer')) {
        return new Response(JSON.stringify({ offerId: 'offer-789' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const adapter = new EbayAdapter('user-1');
    const result = await adapter.createListing({
      ...baseInput,
      publishMode: 'live',
      marketplaceSpecific: { categoryId: '15032', ...validSetup },
    } as any);

    // live mode publishes and returns the published listing id, plus the offer
    // handle and SKU needed to re-sync or re-publish the listing later.
    const publishCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/publish'));
    expect(publishCall).toBeTruthy();
    expect(result.status).toBe('active');
    expect(result.marketplaceListingId).toBe('110012345678');
    expect(result.ebayOfferId).toBe('offer-789');
    expect(result.ebaySku).toMatch(/^portage-/);
  });
});

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
