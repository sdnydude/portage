import { and, eq, lte, asc, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { syncJobs, items, listings, marketplaceSyncLog, marketplaceAccounts } from '../db/schema.js';
import { createLogger } from './logger.js';
import { syncItemListingRow, type ItemSyncSource, type ItemSyncTarget } from './marketplace-sync.js';
import { logSyncAttempt } from './sync-log.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { runOrderSync } from './order-sync.js';

const logger = createLogger('sync-worker');

const MAX_ATTEMPTS = 5;
// Backoff: 30s, 1m, 2m, 4m, 8m — slow-drip retries, Reverb rate-limit friendly.
const BACKOFF_BASE_MS = 30_000;

export interface EnqueueItemSyncInput {
  userId: string;
  itemId: string;
  listingId: string;
  marketplace: 'ebay' | 'etsy' | 'reverb';
  trigger: 'item_edit' | 'listing_edit' | 'photo' | 'publish' | 'mass_sync';
  includePhotos: boolean;
}

/**
 * Enqueue an edit-sync job for one listing row (outbox, refactor P2). A job is
 * a pointer — the worker re-reads current item/listing state at run time — so
 * coalescing is just "newest job per listing wins": pending siblings for the
 * listing are removed before the insert. A running job is left alone (it
 * snapshotted nothing; the new job will re-sync after it).
 */
export async function enqueueItemSync(input: EnqueueItemSyncInput): Promise<void> {
  // Delete+insert must be atomic (audit M3): two concurrent enqueues for the
  // same listing can otherwise both pass the DELETE before either INSERTs,
  // leaving two pending jobs and breaking "newest job per listing wins".
  await db.transaction(async (tx) => {
    const superseded = await tx.delete(syncJobs).where(and(
      eq(syncJobs.listingId, input.listingId),
      eq(syncJobs.status, 'pending'),
    )).returning();
    // A superseded pending job may have carried unpushed photo changes — the
    // replacement must not drop them (CodeRabbit PR #283), so OR the flag.
    const includePhotos = input.includePhotos
      || (superseded ?? []).some((j) => j.includePhotos);
    await tx.insert(syncJobs).values({
      userId: input.userId,
      itemId: input.itemId,
      listingId: input.listingId,
      marketplace: input.marketplace,
      trigger: input.trigger,
      includePhotos,
    });
  });
  logger.debug({ listingId: input.listingId, trigger: input.trigger }, 'sync job enqueued');
}

// Retention (audit m3): neither sync table was ever cleaned, so cost grew for
// the account's lifetime and /status scanned all history. Terminal rows older
// than the window carry no badge signal — the sweep bounds both tables.
const RETENTION_DAYS = 30;
const RETENTION_SWEEP_MS = 24 * 60 * 60_000;

export async function runRetentionSweep(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60_000);
  try {
    await db.delete(syncJobs).where(and(
      inArray(syncJobs.status, ['success', 'failed']),
      lte(syncJobs.updatedAt, cutoff),
    ));
    await db.delete(marketplaceSyncLog).where(lte(marketplaceSyncLog.createdAt, cutoff));
    logger.debug({ cutoff }, 'sync retention sweep completed');
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'sync retention sweep failed');
  }
}

let workerTimer: NodeJS.Timeout | null = null;
let retentionTimer: NodeJS.Timeout | null = null;

// ————— Status reconciliation sweep (b6536cc1, ship-program Phase 2) —————
// Externally-ended/sold listings sat stale-active locally (08-05 incident:
// Trading error 291 on every edit). Periodic scan queues active published
// listings; the drip checks a few per tick against marketplace truth so a
// full sweep never bursts calls (Reverb rate-limit friendly, same posture as
// the outbox backoff).

// Scan cadence: pre-launch single-seller reality; 45 min keeps a full-day
// drift window impossible while staying far under marketplace rate budgets.
const STATUS_SWEEP_SCAN_MS = 45 * 60_000;
const STATUS_DRIP_MS = 5000;
const STATUS_DRIP_BATCH = 2;

interface StatusCheckEntry {
  listingId: string;
  userId: string;
  itemId: string;
  marketplace: 'ebay' | 'reverb';
  marketplaceListingId: string;
}

let statusCheckQueue: StatusCheckEntry[] = [];

/** Load every active published listing into the check queue (idempotent —
 *  a scan while the previous queue is still draining replaces it). */
export async function runStatusSweepScan(): Promise<number> {
  const rows = await db.select().from(listings)
    .where(and(eq(listings.status, 'active'), isNotNull(listings.marketplaceListingId)))
    .limit(500);
  statusCheckQueue = (rows as Array<Record<string, unknown>>)
    .filter((r) => r.marketplace === 'ebay' || r.marketplace === 'reverb')
    .map((r) => ({
      listingId: r.id as string,
      userId: r.userId as string,
      itemId: r.itemId as string,
      marketplace: r.marketplace as 'ebay' | 'reverb',
      marketplaceListingId: r.marketplaceListingId as string,
    }));
  logger.debug({ queued: statusCheckQueue.length }, 'status sweep scan queued listings');
  return statusCheckQueue.length;
}

/** Drain up to `batch` queued listings: read marketplace truth, flip rows on
 *  POSITIVE ended/sold only — 'unknown' (the adapters' swallowed-error value;
 *  Reverb logs before collapsing, eBay logs too as of this change) is a hard
 *  no-op so a token outage can never mass-end the inventory. */
let statusDripInFlight = false;

export async function processStatusCheckQueue(batch = STATUS_DRIP_BATCH): Promise<void> {
  // Re-entrancy guard (M6 pattern): a status check outliving the 5s drip
  // interval must not overlap the next tick — bursting is exactly what the
  // drip exists to prevent.
  if (statusDripInFlight) return;
  statusDripInFlight = true;
  try {
    await processStatusCheckQueueInner(batch);
  } finally {
    statusDripInFlight = false;
  }
}

async function processStatusCheckQueueInner(batch: number): Promise<void> {
  for (let i = 0; i < batch; i++) {
    const entry = statusCheckQueue.shift();
    if (!entry) return;
    const startedAt = Date.now();
    try {
      const adapter = entry.marketplace === 'ebay'
        ? new EbayAdapter(entry.userId)
        : new ReverbAdapter(entry.userId);
      const status = await adapter.getListingStatus(entry.marketplaceListingId);
      if (status !== 'ended' && status !== 'sold') continue; // unknown/active → no-op
      const newStatus = status === 'sold' ? 'sold' : 'archived';
      await db.update(listings)
        .set(status === 'sold'
          ? { status: 'sold', soldAt: new Date(), updatedAt: new Date() }
          : { status: 'archived', updatedAt: new Date() })
        .where(and(eq(listings.id, entry.listingId), eq(listings.status, 'active')));
      void logSyncAttempt({
        userId: entry.userId,
        itemId: entry.itemId,
        listingId: entry.listingId,
        marketplace: entry.marketplace,
        trigger: 'status_sweep',
        status: 'success',
        message: `Marketplace reports ${status} — listing ${newStatus} locally`,
        durationMs: Date.now() - startedAt,
      });
      logger.info({ listingId: entry.listingId, marketplace: entry.marketplace, status }, 'status sweep reconciled listing');
    } catch (err) {
      // Sweep is best-effort per listing — next scan retries naturally — but
      // the failure must land in the durable sync-log like every other worker
      // path (review HIGH-1; PR #283 UI-truth contract), not just pino.
      logger.warn({ listingId: entry.listingId, error: (err as Error).message }, 'status check failed');
      void logSyncAttempt({
        userId: entry.userId,
        itemId: entry.itemId,
        listingId: entry.listingId,
        marketplace: entry.marketplace,
        trigger: 'status_sweep',
        status: 'failure',
        message: (err as Error).message,
        durationMs: Date.now() - startedAt,
      });
    }
  }
}

let statusScanTimer: NodeJS.Timeout | null = null;
let statusDripTimer: NodeJS.Timeout | null = null;

// ————— Periodic order sync (98f9f383, ship-program Phase 2) —————
// Reverb/eBay sales landed without local order rows until someone pressed
// Sync (revenue under-reported; 6 Reverb sales missing on 08-05). Same
// implementation as POST /orders/sync — one run per account-holding user.
const ORDER_SYNC_MS = 45 * 60_000;
let orderSyncTimer: NodeJS.Timeout | null = null;
let orderSyncInFlight = false;

export async function runOrderSyncCycle(): Promise<void> {
  // Serial + guarded: order imports do marketplace calls; overlapping cycles
  // would double-fetch the same 90-day window for no benefit.
  if (orderSyncInFlight) return;
  orderSyncInFlight = true;
  try {
    const accounts = await db.select({ userId: marketplaceAccounts.userId }).from(marketplaceAccounts);
    const userIds = [...new Set(accounts.map((a) => a.userId))];
    for (const userId of userIds) {
      try {
        const result = await runOrderSync(userId);
        if (result.synced > 0) {
          logger.info({ userId, synced: result.synced }, 'periodic order sync imported orders');
        }
        // CRITICAL (review): runOrderSync reports marketplace failures in
        // result.errors, not by throwing — the manual route shows them to a
        // human; this unattended path must surface them durably or a dead
        // token recreates the exact 08-05 missing-orders blind spot.
        for (const e of result.errors) {
          logger.warn({ userId, marketplace: e.marketplace, error: e.message }, 'periodic order sync failed for marketplace');
          void logSyncAttempt({
            userId,
            marketplace: e.marketplace as 'ebay' | 'etsy' | 'reverb',
            trigger: 'order_sync',
            status: 'failure',
            message: e.message,
          });
        }
      } catch (err) {
        logger.warn({ userId, error: (err as Error).message }, 'periodic order sync failed for user');
      }
    }
  } finally {
    orderSyncInFlight = false;
  }
}

/**
 * Crash/restart recovery (CodeRabbit PR #283): a job claimed as 'running'
 * when the process dies would otherwise stay running forever. Single-server
 * deployment, so at boot every 'running' row is by definition orphaned —
 * flip them back to pending for the next tick.
 */
export async function recoverStaleRunningJobs(): Promise<void> {
  await db.update(syncJobs)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(eq(syncJobs.status, 'running'));
}

/**
 * Start the in-process outbox worker (called once from the API bootstrap —
 * NOT from createApp, so tests never spin a timer). Idempotent; unref'd so it
 * never holds the process open.
 */
export function startSyncWorker(intervalMs = 5000, retentionIntervalMs = RETENTION_SWEEP_MS): void {
  if (workerTimer) return;
  void recoverStaleRunningJobs().catch((err) => {
    logger.warn({ error: (err as Error).message }, 'stale running-job recovery failed');
  });
  workerTimer = setInterval(() => {
    void processDueSyncJobs().catch((err) => {
      logger.warn({ error: (err as Error).message }, 'sync worker tick failed');
    });
  }, intervalMs);
  workerTimer.unref();
  // Retention (audit m3): once at boot, then daily. runRetentionSweep never throws.
  void runRetentionSweep();
  retentionTimer = setInterval(() => { void runRetentionSweep(); }, retentionIntervalMs);
  retentionTimer.unref();
  // Status sweep (b6536cc1): scan at boot then every STATUS_SWEEP_SCAN_MS;
  // drain a few checks per drip tick so a scan never bursts marketplace calls.
  void runStatusSweepScan().catch((err) => {
    logger.warn({ error: (err as Error).message }, 'status sweep scan failed');
  });
  statusScanTimer = setInterval(() => {
    void runStatusSweepScan().catch((err) => {
      logger.warn({ error: (err as Error).message }, 'status sweep scan failed');
    });
  }, STATUS_SWEEP_SCAN_MS);
  statusScanTimer.unref();
  statusDripTimer = setInterval(() => {
    // Defensive only: processStatusCheckQueue catches per-entry, so this
    // .catch is unreachable today (review LOW) — kept against future edits
    // that add throwing code outside the per-entry try.
    void processStatusCheckQueue().catch((err) => {
      logger.warn({ error: (err as Error).message }, 'status drip tick failed');
    });
  }, STATUS_DRIP_MS);
  statusDripTimer.unref();
  // Order sync (98f9f383): once at boot, then every ORDER_SYNC_MS.
  void runOrderSyncCycle().catch((err) => {
    logger.warn({ error: (err as Error).message }, 'order sync cycle failed');
  });
  orderSyncTimer = setInterval(() => {
    void runOrderSyncCycle().catch((err) => {
      logger.warn({ error: (err as Error).message }, 'order sync cycle failed');
    });
  }, ORDER_SYNC_MS);
  orderSyncTimer.unref();
  logger.info({ intervalMs }, 'sync worker started');
}

export function stopSyncWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
  if (statusScanTimer) {
    clearInterval(statusScanTimer);
    statusScanTimer = null;
  }
  if (statusDripTimer) {
    clearInterval(statusDripTimer);
    statusDripTimer = null;
  }
  statusCheckQueue = [];
  if (orderSyncTimer) {
    clearInterval(orderSyncTimer);
    orderSyncTimer = null;
  }
}

/**
 * One worker tick: claim due pending jobs (oldest first), execute each via
 * syncItemListingRow with freshly-loaded item/listing state, flip job status,
 * and write a durable sync-log row per attempt.
 */
let tickInFlight = false;

export async function processDueSyncJobs(limit = 5): Promise<void> {
  // Re-entrancy guard (audit M6): a tick outliving the 5s interval must not
  // overlap the next one — N concurrent ticks each claiming `limit` jobs
  // defeats the slow-drip design.
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    await processDueSyncJobsInner(limit);
  } finally {
    tickInFlight = false;
  }
}

// A running job whose status write was lost (transient DB error) would stay
// running forever with boot-only recovery (audit m8). Anything running longer
// than this is stale — no marketplace call takes 10 minutes.
const RUNNING_STALE_MS = 10 * 60_000;

async function processDueSyncJobsInner(limit: number): Promise<void> {
  await db.update(syncJobs)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(and(eq(syncJobs.status, 'running'), lte(syncJobs.updatedAt, new Date(Date.now() - RUNNING_STALE_MS))));

  const due = await db.select().from(syncJobs)
    .where(and(eq(syncJobs.status, 'pending'), lte(syncJobs.nextRunAt, new Date())))
    .orderBy(asc(syncJobs.nextRunAt))
    .limit(limit);

  for (const job of due) {
    // Claim: pending → running, guarded on status so a concurrent tick skips.
    const [claimed] = await db.update(syncJobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(and(eq(syncJobs.id, job.id), eq(syncJobs.status, 'pending')))
      .returning();
    if (!claimed) continue;

    const startedAt = Date.now();
    // Fresh marketplace for log rows (audit m6) — falls back to the job
    // snapshot only when the failure happens before the listing loads.
    let logMarketplace = job.marketplace;
    try {
      const [item] = await db.select().from(items).where(eq(items.id, job.itemId)).limit(1);
      const [listing] = await db.select().from(listings).where(eq(listings.id, job.listingId)).limit(1);
      if (listing) logMarketplace = listing.marketplace;
      if (!item || !listing || !listing.marketplaceListingId) {
        // Target vanished (row deleted, never published) — nothing to sync,
        // but the attempt still gets a durable log row (audit m1).
        await db.update(syncJobs)
          .set({ status: 'success', updatedAt: new Date() })
          .where(eq(syncJobs.id, job.id));
        void logSyncAttempt({
          userId: job.userId,
          itemId: job.itemId,
          listingId: job.listingId,
          marketplace: job.marketplace,
          trigger: job.trigger,
          status: 'success',
          message: 'Sync target vanished — nothing to sync',
          durationMs: Date.now() - startedAt,
        });
        continue;
      }
      // Hard tenant invariant (audit M7): job.userId alone selects the
      // marketplace token, so a mismatched row would push under the wrong
      // seller's account. Terminal fail — retries can't fix ownership.
      if (item.userId !== job.userId || listing.userId !== job.userId) {
        logger.error({ jobId: job.id, listingId: job.listingId, jobUserId: job.userId }, 'sync job ownership mismatch — refusing to sync');
        await db.update(syncJobs)
          .set({ status: 'failed', lastError: 'Ownership mismatch between job and target rows', updatedAt: new Date() })
          .where(eq(syncJobs.id, job.id));
        continue;
      }
      const { warnings } = await syncItemListingRow(
        job.userId,
        item as unknown as ItemSyncSource,
        listing as unknown as ItemSyncTarget,
        { includePhotos: job.includePhotos },
      );
      await db.update(syncJobs)
        .set({ status: 'success', updatedAt: new Date() })
        .where(eq(syncJobs.id, job.id));
      void logSyncAttempt({
        userId: job.userId,
        itemId: job.itemId,
        listingId: job.listingId,
        // Fresh value (audit m6): routing uses listing.marketplace, so the
        // log must record the same, not the enqueue-time snapshot.
        marketplace: logMarketplace,
        trigger: job.trigger,
        status: 'success',
        message: warnings.join('; ') || undefined,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      logger.warn({ jobId: job.id, listingId: job.listingId, error: (err as Error).message }, 'sync job failed');
      // BO-3: a Best Offer conflict is deterministic — retries cannot fix a
      // price-vs-threshold collision, so terminal-fail immediately instead of
      // burning the 5-attempt backoff (~15 min of misleading "Syncing…").
      if (err instanceof AppError && (err.code === 'BEST_OFFER_CONFLICT' || err.code === 'BEST_OFFER_UNSUPPORTED')) {
        await db.update(syncJobs)
          .set({ status: 'failed', lastError: err.message, updatedAt: new Date() })
          .where(eq(syncJobs.id, job.id));
        void logSyncAttempt({
          userId: job.userId,
          itemId: job.itemId,
          listingId: job.listingId,
          marketplace: logMarketplace,
          trigger: job.trigger,
          status: 'failure',
          message: err.message,
          durationMs: Date.now() - startedAt,
        });
        continue;
      }
      const attempts = job.attempts + 1;
      // Exponential backoff (30s * 2^n), capped by MAX_ATTEMPTS → failed.
      await db.update(syncJobs)
        .set(attempts >= MAX_ATTEMPTS
          ? { status: 'failed', attempts, lastError: (err as Error).message, updatedAt: new Date() }
          : {
              status: 'pending',
              attempts,
              lastError: (err as Error).message,
              nextRunAt: new Date(Date.now() + BACKOFF_BASE_MS * 2 ** (attempts - 1)),
              updatedAt: new Date(),
            })
        .where(eq(syncJobs.id, job.id));
      void logSyncAttempt({
        userId: job.userId,
        itemId: job.itemId,
        listingId: job.listingId,
        marketplace: logMarketplace,
        trigger: job.trigger,
        status: 'failure',
        message: (err as Error).message,
        durationMs: Date.now() - startedAt,
      });
    }
  }
}
