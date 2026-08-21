import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/index.js';
import { runOrderSync } from './order-sync.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { findDeletedEbayIdentities, sweepDeletedBuyerRows } from '../marketplace/ebay-deletion-anonymize.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('../marketplace/ebay-adapter.js', () => ({ EbayAdapter: class {} }));
vi.mock('../marketplace/ebay-deletion-anonymize.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../marketplace/ebay-deletion-anonymize.js')>();
  return { ...actual, findDeletedEbayIdentities: vi.fn(async () => new Map<string, string>()), sweepDeletedBuyerRows: vi.fn(async () => ({ orders: 0, messages: 0 })) };
});
vi.mock('../marketplace/reverb-adapter.js', () => ({ ReverbAdapter: class {} }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runOrderSync', () => {
  it('returns synced:0 without touching adapters when the user has no marketplace accounts', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never);

    const result = await runOrderSync('user-1');

    expect(result).toEqual({ synced: 0, newOrders: [], errors: [] });
  });

  it('imports a new eBay order with the redaction marker (no live PII) when the buyer was anonymized by an account-deletion notification', async () => {
    (EbayAdapter as any).prototype.getOrders = vi.fn().mockResolvedValue([{
      marketplaceOrderId: 'ORD-1',
      marketplaceListingId: 'L-1',
      buyerUsername: 'Gone_Buyer',
      salePrice: 50,
      shippingCost: 5,
      marketplaceFees: 3,
      currency: 'USD',
      shippingAddress: { name: 'Gone Buyer', line1: '1 Main St' },
      soldAt: new Date('2026-08-01T00:00:00Z'),
      fulfillmentStatus: 'not_shipped',
    }]);
    vi.mocked(findDeletedEbayIdentities).mockResolvedValueOnce(new Map([['gone_buyer', 'abcdef0123456789']]));

    // 1: accounts, 2: existing order (none), 3: matched listing
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'acct', userId: 'user-1', marketplace: 'ebay' }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'listing-1', itemId: 'item-1' }]) }) }) } as never);
    const values = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'order-1' }]) }),
    });
    vi.mocked(db.insert).mockReturnValue({ values } as never);
    vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);

    const result = await runOrderSync('user-1');

    expect(result.synced).toBe(1);
    expect(findDeletedEbayIdentities).toHaveBeenCalledWith(['Gone_Buyer']);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      buyerUsername: 'deleted-ebay-user',
      shippingAddress: { redacted: 'ebay-account-deletion' },
    }));
    expect(JSON.stringify(values.mock.calls[0][0])).not.toContain('1 Main St');
    // Post-sync sweep re-checks the batch (closes the guard-check → deletion-commit race).
    expect(sweepDeletedBuyerRows).toHaveBeenCalledWith(['Gone_Buyer']);
  });

  it('does not report an account error when only the post-sync sweep fails (orders already imported)', async () => {
    (EbayAdapter as any).prototype.getOrders = vi.fn().mockResolvedValue([{
      marketplaceOrderId: 'ORD-2', marketplaceListingId: 'L-1', buyerUsername: 'fine_buyer',
      salePrice: 10, shippingCost: 0, marketplaceFees: 0, currency: 'USD',
      shippingAddress: null, soldAt: new Date('2026-08-01T00:00:00Z'), fulfillmentStatus: 'not_shipped',
    }]);
    vi.mocked(findDeletedEbayIdentities).mockResolvedValueOnce(new Map());
    vi.mocked(sweepDeletedBuyerRows).mockRejectedValueOnce(new Error('sweep blip'));
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'acct', userId: 'user-1', marketplace: 'ebay' }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'listing-1', itemId: 'item-1' }]) }) }) } as never);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'order-2' }]) }) }),
    } as never);
    vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);

    const result = await runOrderSync('user-1');

    expect(result.synced).toBe(1);
    expect(result.errors).toEqual([]);
  });
});
