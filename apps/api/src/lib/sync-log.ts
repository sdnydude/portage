import { db } from '../db/index.js';
import { marketplaceSyncLog } from '../db/schema.js';
import { createLogger } from './logger.js';

const logger = createLogger('sync-log');

export interface SyncAttempt {
  userId: string;
  itemId?: string | null;
  listingId?: string | null;
  marketplace: 'ebay' | 'etsy' | 'reverb';
  trigger: 'item_edit' | 'listing_edit' | 'photo' | 'publish' | 'mass_sync';
  status: 'success' | 'failure';
  message?: string | null;
  errors?: unknown;
  durationMs?: number | null;
}

/**
 * Durable sync-log write (refactor P1). Fire-and-forget contract: the log is
 * diagnostics, so a logging failure must never fail or delay the sync path
 * that called it — callers may await it but must never depend on it.
 */
export async function logSyncAttempt(attempt: SyncAttempt): Promise<void> {
  try {
    await db.insert(marketplaceSyncLog).values({
      userId: attempt.userId,
      itemId: attempt.itemId ?? null,
      listingId: attempt.listingId ?? null,
      marketplace: attempt.marketplace,
      trigger: attempt.trigger,
      status: attempt.status,
      message: attempt.message ?? null,
      errors: attempt.errors ?? null,
      durationMs: attempt.durationMs ?? null,
    });
  } catch (err) {
    logger.warn({ err, listingId: attempt.listingId }, 'sync-log write failed — attempt not recorded');
  }
}
