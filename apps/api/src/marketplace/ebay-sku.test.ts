import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/index.js', () => ({
  db: { execute: vi.fn(), update: vi.fn() },
}));

import { formatEbaySku, ensureItemEbaySku } from './ebay-sku.js';
import { items } from '../db/schema.js';
import { db } from '../db/index.js';

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
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('mints via a single atomic UPDATE...COALESCE so concurrent publishes converge on one SKU', async () => {
    // No SKU yet: the mint + persist must be one atomic statement (not a read-then-write
    // that races two publishes into two SKUs and a second eBay inventory_item).
    vi.mocked(db.execute).mockResolvedValue([{ sku: 'PRT-000100' }] as any);
    const sku = await ensureItemEbaySku({ id: 'item-9', ebaySku: null });
    expect(sku).toBe('PRT-000100');
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });
});
