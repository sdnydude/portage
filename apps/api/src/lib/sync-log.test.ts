import { db } from '../db/index.js';
import { logSyncAttempt } from './sync-log.js';

vi.mock('../db/index.js', () => ({
  db: { insert: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logSyncAttempt', () => {
  it('inserts a marketplace_sync_log row with the given attempt fields', async () => {
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    await logSyncAttempt({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      status: 'failure',
      message: 'Reverb 422: shipping required',
      errors: [{ field: 'shipping', message: 'required' }],
      durationMs: 812,
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      status: 'failure',
      message: 'Reverb 422: shipping required',
      errors: [{ field: 'shipping', message: 'required' }],
      durationMs: 812,
    }));
  });

  it('never throws when the insert fails — the log is diagnostics, not the sync path', async () => {
    vi.mocked(db.insert).mockImplementation(() => { throw new Error('db down'); });

    await expect(logSyncAttempt({
      userId: 'user-1',
      marketplace: 'ebay',
      trigger: 'listing_edit',
      status: 'success',
    })).resolves.toBeUndefined();
  });
});
