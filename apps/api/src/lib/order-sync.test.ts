import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/index.js';
import { runOrderSync } from './order-sync.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('../marketplace/ebay-adapter.js', () => ({ EbayAdapter: class {} }));
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
});
