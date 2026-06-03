import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadEnv } from '../lib/env.js';
import { resolveEbayCondition, validateEbayListingFields, EbayAdapter } from './ebay-adapter.js';

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
