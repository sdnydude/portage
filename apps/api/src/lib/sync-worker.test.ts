import { db } from '../db/index.js';
import { enqueueItemSync, processDueSyncJobs, startSyncWorker, stopSyncWorker, recoverStaleRunningJobs, runRetentionSweep, runStatusSweepScan, processStatusCheckQueue, runOrderSyncCycle } from './sync-worker.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

const { mockSyncItemListingRow, mockLogSyncAttempt, mockEbayGetListingStatus, mockReverbGetListingStatus } = vi.hoisted(() => ({
  mockSyncItemListingRow: vi.fn(), mockLogSyncAttempt: vi.fn(),
  mockEbayGetListingStatus: vi.fn(), mockReverbGetListingStatus: vi.fn(),
}));
vi.mock('./marketplace-sync.js', () => ({ syncItemListingRow: mockSyncItemListingRow }));
vi.mock('./sync-log.js', () => ({ logSyncAttempt: mockLogSyncAttempt }));
vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: class { getListingStatus = mockEbayGetListingStatus; },
}));
vi.mock('../marketplace/reverb-adapter.js', () => ({
  ReverbAdapter: class { getListingStatus = mockReverbGetListingStatus; },
}));
const { mockRunOrderSync } = vi.hoisted(() => ({ mockRunOrderSync: vi.fn() }));
vi.mock('./order-sync.js', () => ({ runOrderSync: mockRunOrderSync }));

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

describe('processDueSyncJobs — Best Offer conflict is terminal (BO-3)', () => {
  it('fails the job immediately on BEST_OFFER_CONFLICT — a deterministic conflict must not burn 5 backoff retries', async () => {
    mockSelectChainOnce([JOB]);          // due query
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([ITEM_ROW]);     // item load
    mockSelectChainOnce([LISTING_ROW]);  // listing load
    const conflict = Object.assign(new Error('price at or below thresholds'), { name: 'AppError', statusCode: 422, code: 'BEST_OFFER_CONFLICT' });
    Object.setPrototypeOf(conflict, (await import("../middleware/error.js")).AppError.prototype);
    mockSyncItemListingRow.mockRejectedValueOnce(conflict);

    await processDueSyncJobs();

    const failedCall = setSpy.mock.calls.map(c => c[0] as Record<string, unknown>)
      .find(v => v.status === 'failed');
    expect(failedCall).toBeDefined();
    expect(failedCall!.lastError).toMatch(/thresholds/);
    // No backoff reschedule: nothing set back to pending with attempts
    const backoffCall = setSpy.mock.calls.map(c => c[0] as Record<string, unknown>)
      .find(v => v.status === 'pending' && 'attempts' in v);
    expect(backoffCall).toBeUndefined();
  });
});

describe('processDueSyncJobs — deterministic aspect failures (Housekeeping-1 review)', () => {
  it('fails the job immediately on EBAY_ASPECTS_REQUIRED — a missing required specific cannot be fixed by retrying', async () => {
    mockSelectChainOnce([JOB]);
    const returningSpy = vi.fn().mockResolvedValue([{ ...JOB, status: 'running' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectChainOnce([ITEM_ROW]);
    mockSelectChainOnce([LISTING_ROW]);
    const err = Object.assign(new Error('eBay requires: Brand'), { name: 'AppError', statusCode: 422, code: 'EBAY_ASPECTS_REQUIRED' });
    Object.setPrototypeOf(err, (await import("../middleware/error.js")).AppError.prototype);
    mockSyncItemListingRow.mockRejectedValueOnce(err);

    await processDueSyncJobs();

    const calls = setSpy.mock.calls.map(c => c[0] as Record<string, unknown>);
    expect(calls.find(v => v.status === 'failed')?.lastError).toMatch(/requires: Brand/);
    expect(calls.find(v => v.status === 'pending' && 'attempts' in v)).toBeUndefined();
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

    expect(db.delete).toHaveBeenCalledTimes(3); // sync_jobs + marketplace_sync_log + export_tokens
  });

  it('also sweeps export_tokens expired more than 7 days ago (P7 d65d1e9e — named operator approval 2026-08-25)', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereSpy } as any);

    await runRetentionSweep();

    // sync_jobs + marketplace_sync_log + export_tokens
    expect(db.delete).toHaveBeenCalledTimes(3);
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

      expect(db.delete).toHaveBeenCalledTimes(3); // sync_jobs + marketplace_sync_log + export_tokens
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
      expect(db.delete).toHaveBeenCalledTimes(6); // boot sweep + one interval sweep, 3 tables each

      stopSyncWorker();
      await vi.advanceTimersByTimeAsync(5000);
      expect(db.delete).toHaveBeenCalledTimes(6); // timer cleared — no further sweeps
    } finally {
      stopSyncWorker();
      vi.useRealTimers();
    }
  });

  it('ticks processDueSyncJobs on the interval and is idempotent (double-start registers one timer)', async () => {
    vi.useFakeTimers();
    try {
      // Each tick starts with the due query — count db.select calls per tick.
      // Boot now also runs one status-sweep scan + one order-sync accounts
      // query (Phase 2, b6536cc1 + 98f9f383).
      mockSelectChainOnce([]); // boot status-sweep scan
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([]),
      } as never); // boot order-sync accounts query
      mockSelectChainOnce([]); // tick 1 due query (empty — tick ends)
      mockSelectChainOnce([]); // tick 2 due query

      startSyncWorker(1000);
      startSyncWorker(1000); // second start must be a no-op

      await vi.advanceTimersByTimeAsync(1000);
      expect(db.select).toHaveBeenCalledTimes(3); // boot scan + accounts + one tick due query — not two timers

      await vi.advanceTimersByTimeAsync(1000);
      expect(db.select).toHaveBeenCalledTimes(4);
    } finally {
      stopSyncWorker();
      vi.useRealTimers();
    }
  });
});

describe('status reconciliation sweep (b6536cc1)', () => {
  it('flips an externally-ended eBay listing to archived and writes a sync-log row', async () => {
    // Scan: active published listings queued for checking.
    mockSelectChainOnce([{
      id: 'listing-9', userId: 'user-1', itemId: 'item-9', marketplace: 'ebay',
      marketplaceListingId: '307000000001', status: 'active',
    }]);
    mockEbayGetListingStatus.mockResolvedValueOnce('ended');
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: whereSpy }) } as any);

    await runStatusSweepScan();
    await processStatusCheckQueue(1);

    expect(mockEbayGetListingStatus).toHaveBeenCalledWith('307000000001');
    expect(db.update).toHaveBeenCalledTimes(1); // ended -> archived write
    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({
      listingId: 'listing-9',
      trigger: 'status_sweep',
      status: 'success',
      message: expect.stringMatching(/archived|ended/i),
    }));
  });

  it('flips a sold-on-marketplace Reverb listing to sold with soldAt stamped', async () => {
    mockSelectChainOnce([{
      id: 'listing-10', userId: 'user-1', itemId: 'item-10', marketplace: 'reverb',
      marketplaceListingId: '99270095', status: 'active',
    }]);
    mockReverbGetListingStatus.mockResolvedValueOnce('sold');
    const setSpy = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    await runStatusSweepScan();
    await processStatusCheckQueue(1);

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sold',
      soldAt: expect.any(Date),
    }));
  });

  it("'unknown' (the adapters' swallowed-error value) is a hard no-op — a token outage must never mass-end inventory", async () => {
    mockSelectChainOnce([{
      id: 'listing-11', userId: 'user-1', itemId: 'item-11', marketplace: 'ebay',
      marketplaceListingId: '307000000002', status: 'active',
    }]);
    mockEbayGetListingStatus.mockResolvedValueOnce('unknown');

    await runStatusSweepScan();
    await processStatusCheckQueue(1);

    expect(db.update).not.toHaveBeenCalled();
    expect(mockLogSyncAttempt).not.toHaveBeenCalled();
  });

  it('an adapter error mid-check logs a warning, leaves the listing untouched, and the batch continues', async () => {
    mockSelectChainOnce([
      { id: 'listing-13', userId: 'user-1', itemId: 'item-13', marketplace: 'ebay',
        marketplaceListingId: '307000000004', status: 'active' },
      { id: 'listing-14', userId: 'user-1', itemId: 'item-14', marketplace: 'ebay',
        marketplaceListingId: '307000000005', status: 'active' },
    ]);
    mockEbayGetListingStatus
      .mockRejectedValueOnce(new Error('eBay 401: invalid scope'))
      .mockResolvedValueOnce('ended');
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: whereSpy }) } as any);

    await runStatusSweepScan();
    await processStatusCheckQueue(2);

    // First entry failed without a listing write; second still processed
    // (ended -> archived). The failure itself lands durably (review HIGH-1).
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({
      listingId: 'listing-13',
      trigger: 'status_sweep',
      status: 'failure',
      message: expect.stringMatching(/invalid scope/),
    }));
    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'listing-14', status: 'success' }));
  });

  it('a second scan while the queue is draining REPLACES it — stale entries are never processed', async () => {
    mockSelectChainOnce([{
      id: 'listing-A', userId: 'user-1', itemId: 'item-A', marketplace: 'ebay',
      marketplaceListingId: '307000000006', status: 'active',
    }]);
    await runStatusSweepScan();
    // Rescan before draining: only B may be checked afterwards.
    mockSelectChainOnce([{
      id: 'listing-B', userId: 'user-1', itemId: 'item-B', marketplace: 'ebay',
      marketplaceListingId: '307000000007', status: 'active',
    }]);
    await runStatusSweepScan();
    mockEbayGetListingStatus.mockResolvedValue('unknown');

    await processStatusCheckQueue(5);

    expect(mockEbayGetListingStatus).toHaveBeenCalledTimes(1);
    expect(mockEbayGetListingStatus).toHaveBeenCalledWith('307000000007');
  });

  it('a drip tick overlapping a slow status check is a no-op (M6 pattern) — no marketplace-call bursts', async () => {
    mockSelectChainOnce([
      { id: 'listing-C', userId: 'user-1', itemId: 'item-C', marketplace: 'ebay',
        marketplaceListingId: '307000000008', status: 'active' },
      { id: 'listing-D', userId: 'user-1', itemId: 'item-D', marketplace: 'ebay',
        marketplaceListingId: '307000000009', status: 'active' },
    ]);
    await runStatusSweepScan();
    let releaseCheck!: (v: string) => void;
    mockEbayGetListingStatus.mockReturnValueOnce(new Promise((resolve) => { releaseCheck = resolve; }));

    const first = processStatusCheckQueue(1);   // hangs on the slow check
    await processStatusCheckQueue(1);           // overlapping tick — must bail

    expect(mockEbayGetListingStatus).toHaveBeenCalledTimes(1); // second tick took nothing
    releaseCheck('unknown');
    await first;
  });

  it('startSyncWorker registers the sweep scan + drip timers (drip drains the queue on cadence)', async () => {
    vi.useFakeTimers();
    try {
      // Boot order: recover (update) → retention (deletes) → SCAN (select #1);
      // the first 5s tick then runs the worker due query (select #2) + drip.
      mockSelectChainOnce([{
        id: 'listing-12', userId: 'user-1', itemId: 'item-12', marketplace: 'ebay',
        marketplaceListingId: '307000000003', status: 'active',
      }]); // immediate boot scan
      mockSelectChainOnce([]); // worker tick 1 due query
      mockEbayGetListingStatus.mockResolvedValue('ended');
      const whereSpy = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: whereSpy }) } as any);

      startSyncWorker(5000);
      await vi.advanceTimersByTimeAsync(5000); // one drip tick

      expect(mockEbayGetListingStatus).toHaveBeenCalledWith('307000000003');
      expect(db.update).toHaveBeenCalled(); // ended → archived via the drip
    } finally {
      stopSyncWorker();
      vi.useRealTimers();
    }
  });
});

describe('periodic order sync (98f9f383)', () => {
  it('boot runs runOrderSync once per account-holding user', async () => {
    vi.useFakeTimers();
    try {
      mockSelectChainOnce([]); // boot status-sweep scan
      // Boot order-sync accounts query awaits .from() directly (no where):
      // two accounts share a user → dedup to 2 users.
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([
          { userId: 'user-1' }, { userId: 'user-1' }, { userId: 'user-2' },
        ]),
      } as never);
      mockRunOrderSync.mockResolvedValue({ synced: 0, newOrders: [], errors: [] });

      startSyncWorker(5000);
      await vi.advanceTimersByTimeAsync(0); // flush boot microtasks

      expect(mockRunOrderSync).toHaveBeenCalledTimes(2);
      expect(mockRunOrderSync).toHaveBeenCalledWith('user-1');
      expect(mockRunOrderSync).toHaveBeenCalledWith('user-2');
    } finally {
      stopSyncWorker();
      vi.useRealTimers();
    }
  });

  it('a second runOrderSyncCycle while one is in flight is a no-op — no double-fetch of the order window', async () => {
    let releaseAccounts!: (rows: unknown[]) => void;
    const hanging = new Promise<unknown[]>((resolve) => { releaseAccounts = resolve; });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(hanging),
    } as never);
    mockRunOrderSync.mockResolvedValue({ synced: 0, newOrders: [], errors: [] });

    const first = runOrderSyncCycle();
    await runOrderSyncCycle(); // overlapping call — must bail on the guard

    expect(db.select).toHaveBeenCalledTimes(1); // second call never queried accounts
    releaseAccounts([{ userId: 'user-1' }]);
    await first;
    expect(mockRunOrderSync).toHaveBeenCalledTimes(1);
  });

  it('per-marketplace order-sync failures land in the durable sync-log — the unattended path must not eat them', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ userId: 'user-1' }]),
    } as never);
    mockRunOrderSync.mockResolvedValueOnce({
      synced: 0,
      newOrders: [],
      errors: [{ marketplace: 'reverb', message: 'Reverb API error (401): invalid token' }],
    });

    await runOrderSyncCycle();

    expect(mockLogSyncAttempt).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      marketplace: 'reverb',
      trigger: 'order_sync',
      status: 'failure',
      message: expect.stringMatching(/invalid token/),
    }));
  });
});
