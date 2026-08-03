import { db } from '../db/index.js';
import { enqueueItemSync, processDueSyncJobs, startSyncWorker, stopSyncWorker } from './sync-worker.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const { mockSyncItemListingRow, mockLogSyncAttempt } = vi.hoisted(() => ({
  mockSyncItemListingRow: vi.fn(), mockLogSyncAttempt: vi.fn(),
}));
vi.mock('./marketplace-sync.js', () => ({ syncItemListingRow: mockSyncItemListingRow }));
vi.mock('./sync-log.js', () => ({ logSyncAttempt: mockLogSyncAttempt }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enqueueItemSync', () => {
  it('coalesces per listing: deletes pending siblings for the listing, then inserts the new job', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereSpy } as any);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    await enqueueItemSync({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      includePhotos: false,
    });

    expect(db.delete).toHaveBeenCalledTimes(1); // pending siblings for listing-1 removed first
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      includePhotos: false,
    }));
  });
});

const JOB = {
  id: 'job-1',
  userId: 'user-1',
  itemId: 'item-1',
  listingId: 'listing-1',
  marketplace: 'reverb',
  trigger: 'item_edit',
  status: 'pending',
  includePhotos: false,
  attempts: 0,
  nextRunAt: new Date('2026-08-03T00:00:00Z'),
  lastError: null,
  createdAt: new Date('2026-08-03T00:00:00Z'),
  updatedAt: new Date('2026-08-03T00:00:00Z'),
};

const ITEM_ROW = { id: 'item-1', title: 'Strat', quantity: 1, photos: [] };
const LISTING_ROW = {
  id: 'listing-1', marketplace: 'reverb', status: 'active',
  marketplaceListingId: '87654321', ebaySku: null,
  marketplaceSpecificFields: { categoryUuid: 'cat-1' }, currency: 'USD',
};

function mockSelectChainOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as any);
}

describe('processDueSyncJobs', () => {
  it('claims a due job, executes it via syncItemListingRow, marks it success, and writes a sync-log row', async () => {
    mockSelectChainOnce([JOB]);          // due query
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([ITEM_ROW]);     // item load
    mockSelectChainOnce([LISTING_ROW]);  // listing load
    mockSyncItemListingRow.mockResolvedValueOnce({ warnings: [] });

    await processDueSyncJobs();

    expect(mockSyncItemListingRow).toHaveBeenCalledWith(
      'user-1',
      ITEM_ROW,
      expect.objectContaining({ id: 'listing-1', marketplaceListingId: '87654321' }),
      { includePhotos: false },
    );
    // Final job state flip includes success
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      status: 'success',
    }));
  });

  it('reschedules a failed job with backoff: attempts+1, back to pending, future nextRunAt, lastError set', async () => {
    mockSelectChainOnce([JOB]);          // due query
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([ITEM_ROW]);     // item load
    mockSelectChainOnce([LISTING_ROW]);  // listing load
    mockSyncItemListingRow.mockRejectedValueOnce(new Error('Reverb 503'));

    await processDueSyncJobs();

    const retryCall = setSpy.mock.calls.map(c => c[0] as Record<string, unknown>)
      .find(v => v.status === 'pending');
    expect(retryCall).toBeDefined();
    expect(retryCall).toMatchObject({ attempts: 1, lastError: 'Reverb 503' });
    expect((retryCall!.nextRunAt as Date).getTime()).toBeGreaterThan(Date.now());
    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({ status: 'failure', message: 'Reverb 503' }));
  });

  it('marks a job failed (terminal) when the failure exhausts MAX_ATTEMPTS', async () => {
    mockSelectChainOnce([{ ...JOB, attempts: 4 }]); // due query — 5th attempt incoming
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, attempts: 4, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([ITEM_ROW]);     // item load
    mockSelectChainOnce([LISTING_ROW]);  // listing load
    mockSyncItemListingRow.mockRejectedValueOnce(new Error('Reverb 503'));

    await processDueSyncJobs();

    const terminalCall = setSpy.mock.calls.map(c => c[0] as Record<string, unknown>)
      .find(v => v.status === 'failed');
    expect(terminalCall).toBeDefined();
    expect(terminalCall).toMatchObject({ attempts: 5, lastError: 'Reverb 503' });
  });
});

describe('startSyncWorker', () => {
  it('ticks processDueSyncJobs on the interval and is idempotent (double-start registers one timer)', async () => {
    vi.useFakeTimers();
    try {
      // Each tick starts with the due query — count db.select calls per tick.
      mockSelectChainOnce([]); // tick 1 due query (empty — tick ends)
      mockSelectChainOnce([]); // tick 2 due query

      startSyncWorker(1000);
      startSyncWorker(1000); // second start must be a no-op

      await vi.advanceTimersByTimeAsync(1000);
      expect(db.select).toHaveBeenCalledTimes(1); // one tick, one due query — not two timers

      await vi.advanceTimersByTimeAsync(1000);
      expect(db.select).toHaveBeenCalledTimes(2);
    } finally {
      stopSyncWorker();
      vi.useRealTimers();
    }
  });
});
