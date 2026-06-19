import { describe, it, expect } from 'vitest';
import { formatEbaySku } from './ebay-sku.js';
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
