import { and, eq, lte, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { syncJobs, items, listings } from '../db/schema.js';
import { createLogger } from './logger.js';
import { syncItemListingRow, type ItemSyncSource, type ItemSyncTarget } from './marketplace-sync.js';
import { logSyncAttempt } from './sync-log.js';

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
  await db.delete(syncJobs).where(and(
    eq(syncJobs.listingId, input.listingId),
    eq(syncJobs.status, 'pending'),
  ));
  await db.insert(syncJobs).values({
    userId: input.userId,
    itemId: input.itemId,
    listingId: input.listingId,
    marketplace: input.marketplace,
    trigger: input.trigger,
    includePhotos: input.includePhotos,
  });
  logger.debug({ listingId: input.listingId, trigger: input.trigger }, 'sync job enqueued');
}

let workerTimer: NodeJS.Timeout | null = null;

/**
 * Start the in-process outbox worker (called once from the API bootstrap —
 * NOT from createApp, so tests never spin a timer). Idempotent; unref'd so it
 * never holds the process open.
 */
export function startSyncWorker(intervalMs = 5000): void {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    void processDueSyncJobs().catch((err) => {
      logger.warn({ error: (err as Error).message }, 'sync worker tick failed');
    });
  }, intervalMs);
  workerTimer.unref();
  logger.info({ intervalMs }, 'sync worker started');
}

export function stopSyncWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

/**
 * One worker tick: claim due pending jobs (oldest first), execute each via
 * syncItemListingRow with freshly-loaded item/listing state, flip job status,
 * and write a durable sync-log row per attempt.
 */
export async function processDueSyncJobs(limit = 5): Promise<void> {
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
    try {
      const [item] = await db.select().from(items).where(eq(items.id, job.itemId)).limit(1);
      const [listing] = await db.select().from(listings).where(eq(listings.id, job.listingId)).limit(1);
      if (!item || !listing || !listing.marketplaceListingId) {
        // Target vanished (row deleted, never published) — nothing to sync,
        // nothing to log as attempted.
        await db.update(syncJobs)
          .set({ status: 'success', updatedAt: new Date() })
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
        marketplace: job.marketplace,
        trigger: job.trigger,
        status: 'success',
        message: warnings.join('; ') || undefined,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      logger.warn({ jobId: job.id, listingId: job.listingId, error: (err as Error).message }, 'sync job failed');
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
        marketplace: job.marketplace,
        trigger: job.trigger,
        status: 'failure',
        message: (err as Error).message,
        durationMs: Date.now() - startedAt,
      });
    }
  }
}
