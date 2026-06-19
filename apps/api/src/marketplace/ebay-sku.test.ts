import { describe, it, expect } from 'vitest';
import { formatEbaySku, ensureItemEbaySku } from './ebay-sku.js';
import { items } from '../db/schema.js';

describe('formatEbaySku — serialized eBay SKU', () => {
  it('zero-pads the sequence into a 6-digit PRT- serial', () => {
    expect(formatEbaySku(123)).toBe('PRT-000123');
  });
});

describe('items schema — stable eBay SKU column', () => {
  it('exposes items.ebaySku so the minted SKU persists on the item, not just the listing', () => {
    expect(items.ebaySku).toBeDefined();
  });
});

describe('ensureItemEbaySku — reuse over re-mint', () => {
  it('returns the item\'s existing SKU unchanged (never mints a second one — the churn that trips ATO)', async () => {
    // Item already carries a SKU → no DB write, no nextval; the same SKU comes back.
    const sku = await ensureItemEbaySku({ id: 'item-1', ebaySku: 'PRT-000042' });
    expect(sku).toBe('PRT-000042');
  });
});
