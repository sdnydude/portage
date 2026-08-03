import { db } from '../db/index.js';
import { enqueueItemSync, processDueSyncJobs, startSyncWorker, stopSyncWorker, recoverStaleRunningJobs, runRetentionSweep } from './sync-worker.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
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
    const whereSpy = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const deleteSpy = vi.fn().mockReturnValue({ where: whereSpy });
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    const tx = { delete: deleteSpy, insert: vi.fn().mockReturnValue({ values: valuesSpy }) };
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

    await enqueueItemSync({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      includePhotos: false,
    });

    expect(deleteSpy).toHaveBeenCalledTimes(1); // pending siblings for listing-1 removed first
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      includePhotos: false,
    }));
  });

  it('runs the coalesce delete + insert atomically inside one transaction (audit M3)', async () => {
    const whereSpy = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    const tx = {
      delete: vi.fn().mockReturnValue({ where: whereSpy }),
      insert: vi.fn().mockReturnValue({ values: valuesSpy }),
    };
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

    await enqueueItemSync({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      includePhotos: false,
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'listing-1' }));
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

const ITEM_ROW = { id: 'item-1', userId: 'user-1', title: 'Strat', quantity: 1, photos: [] };
const LISTING_ROW = {
  id: 'listing-1', userId: 'user-1', marketplace: 'reverb', status: 'active',
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

  it('logs the fresh listing.marketplace, not the enqueue-time job.marketplace (audit m6)', async () => {
    mockSelectChainOnce([JOB]);          // job says reverb
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([ITEM_ROW]);     // item load
    mockSelectChainOnce([{ ...LISTING_ROW, marketplace: 'ebay' }]); // listing moved to ebay
    mockSyncItemListingRow.mockResolvedValueOnce({ warnings: [] });

    await processDueSyncJobs();

    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({ marketplace: 'ebay' }));
  });

  it('writes a sync-log row when the target vanished, keeping the audit trail complete (audit m1)', async () => {
    mockSelectChainOnce([JOB]);          // due query
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([]);             // item gone
    mockSelectChainOnce([]);             // listing gone

    await processDueSyncJobs();

    expect(mockSyncItemListingRow).not.toHaveBeenCalled();
    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({
      listingId: 'listing-1',
      status: 'success',
      message: expect.stringMatching(/vanished|nothing to sync/i),
    }));
  });

  it('fails the job at the execution boundary when the loaded listing belongs to a different user (audit M7)', async () => {
    mockSelectChainOnce([JOB]);          // due query
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([ITEM_ROW]);     // item load
    mockSelectChainOnce([{ ...LISTING_ROW, userId: 'user-2' }]); // cross-tenant row

    await processDueSyncJobs();

    expect(mockSyncItemListingRow).not.toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
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

    // 'attempts' excludes the per-tick stale-running sweep, which also sets pending
    const retryCall = setSpy.mock.calls.map(c => c[0] as Record<string, unknown>)
      .find(v => v.status === 'pending' && 'attempts' in v);
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

describe('processDueSyncJobs — re-entrancy (audit M6)', () => {
  it('a second call while one is in flight is a no-op — overlapping ticks must not double-claim', async () => {
    let resolveSelect!: (rows: unknown[]) => void;
    const hanging = new Promise<unknown[]>((r) => { resolveSelect = r; });
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(hanging),
          }),
        }),
      }),
    } as any);

    const first = processDueSyncJobs();
    const second = processDueSyncJobs();
    await second;

    expect(db.select).toHaveBeenCalledTimes(1);
    resolveSelect([]);
    await first;
  });
});

describe('processDueSyncJobs — stale running sweep (audit m8)', () => {
  it('flips long-running jobs back to pending each tick so a lost status write cannot strand them until restart', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([]); // no due jobs this tick

    await processDueSyncJobs();

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });
});

describe('enqueueItemSync — photo-flag coalescing', () => {
  it('keeps includePhotos true when a superseded pending job carried it and the new edit does not', async () => {
    // The delete returns the superseded pending rows so the flag can be OR'd.
    const returningSpy = vi.fn().mockResolvedValue([{ id: 'old-job', includePhotos: true }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    const tx = {
      delete: vi.fn().mockReturnValue({ where: whereSpy }),
      insert: vi.fn().mockReturnValue({ values: valuesSpy }),
    };
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

    await enqueueItemSync({
      userId: 'user-1',
      itemId: 'item-1',
      listingId: 'listing-1',
      marketplace: 'reverb',
      trigger: 'item_edit',
      includePhotos: false, // title-only edit
    });

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ includePhotos: true }));
  });
});

describe('runRetentionSweep (audit m3)', () => {
  it('deletes terminal sync_jobs and old marketplace_sync_log rows past the retention window', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereSpy } as any);

    await runRetentionSweep();

    expect(db.delete).toHaveBeenCalledTimes(2); // sync_jobs + marketplace_sync_log
  });
});

describe('recoverStaleRunningJobs', () => {
  it('resets running jobs back to pending so a restart never strands them', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    await recoverStaleRunningJobs();

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });
});

describe('startSyncWorker', () => {
  it('runs a retention sweep at boot (audit m3 wiring)', async () => {
    vi.useFakeTimers();
    try {
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: deleteWhere } as any);

      startSyncWorker(1000);
      await vi.advanceTimersByTimeAsync(0); // flush the boot-time microtasks

      expect(db.delete).toHaveBeenCalledTimes(2); // sync_jobs + marketplace_sync_log
    } finally {
      stopSyncWorker();
      vi.useRealTimers();
    }
  });

  it('re-runs the retention sweep on its own interval, and stop clears that timer (audit m3 wiring)', async () => {
    vi.useFakeTimers();
    try {
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: deleteWhere } as any);
      mockSelectChainOnce([]); // tick 1 due query
      mockSelectChainOnce([]); // tick 2 due query

      startSyncWorker(1000, 2500);
      await vi.advanceTimersByTimeAsync(2500);
      expect(db.delete).toHaveBeenCalledTimes(4); // boot sweep + one interval sweep, 2 tables each

      stopSyncWorker();
      await vi.advanceTimersByTimeAsync(5000);
      expect(db.delete).toHaveBeenCalledTimes(4); // timer cleared — no further sweeps
    } finally {
      stopSyncWorker();
      vi.useRealTimers();
    }
  });

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
