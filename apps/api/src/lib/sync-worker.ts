import { and, eq, lte, asc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { syncJobs, items, listings, marketplaceSyncLog } from '../db/schema.js';
import { createLogger } from './logger.js';
import { syncItemListingRow, type ItemSyncSource, type ItemSyncTarget } from './marketplace-sync.js';
import { logSyncAttempt } from './sync-log.js';
import { AppError } from '../middleware/error.js';

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
