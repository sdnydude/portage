import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { marketplaceSyncLog, syncJobs, listings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { enqueueItemSync } from '../lib/sync-worker.js';

export const syncLogRouter = Router();
syncLogRouter.use(requireAuth);

const statusQuerySchema = z.object({
  listingIds: z.string().min(1).transform((s) => s.split(',').filter(Boolean).slice(0, 50)),
});

// Per-listing badge state for the P3 truth surface, derived from the newest
// sync_jobs row per listing: pending/running → 'pending', failed → 'failed'
// (with lastError), success → 'synced'. Listings with no job history are
// omitted — the UI shows no badge for never-synced rows.
syncLogRouter.get('/status', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const q = statusQuerySchema.parse(req.query);

    const jobs = await db.select()
      .from(syncJobs)
      .where(and(eq(syncJobs.userId, userId), inArray(syncJobs.listingId, q.listingIds)))
      .orderBy(desc(syncJobs.updatedAt));

    const statuses: Array<{ listingId: string; state: 'pending' | 'failed' | 'synced'; lastAttemptAt: string; message?: string }> = [];
    const seen = new Set<string>();
    for (const job of jobs) {
      if (seen.has(job.listingId)) continue; // newest row per listing wins
      seen.add(job.listingId);
      const state = job.status === 'pending' || job.status === 'running' ? 'pending'
        : job.status === 'failed' ? 'failed'
        : 'synced';
      statuses.push({
        listingId: job.listingId,
        state,
        lastAttemptAt: job.updatedAt.toISOString(),
        ...(state === 'failed' && job.lastError ? { message: job.lastError } : {}),
      });
    }

    res.json({ statuses });
  } catch (err) {
    next(err);
  }
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['success', 'failure']).optional(),
  listingId: z.string().uuid().optional(),
});

const retryBodySchema = z.object({ listingId: z.string().min(1) });

// P3 retry affordance: re-enqueue a full sync (photos included) for one
// caller-owned listing — used by the failed badge + sync-log screen.
syncLogRouter.post('/retry', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = retryBodySchema.parse(req.body);

    const [listing] = await db.select()
      .from(listings)
      .where(and(eq(listings.id, body.listingId), eq(listings.userId, userId)))
      .limit(1);
    if (!listing || !listing.marketplaceListingId) {
      throw new AppError(404, 'NOT_FOUND', 'No syncable listing found');
    }

    await enqueueItemSync({
      userId,
      itemId: listing.itemId,
      listingId: listing.id,
      marketplace: listing.marketplace,
      trigger: 'item_edit',
      includePhotos: true,
    });

    res.status(202).json({ queued: true, listingId: listing.id });
  } catch (err) {
    next(err);
  }
});

// Paginated, caller-scoped sync history (refactor P1) — date-desc per the
// Reverb sync-screen spec. Feeds the sync-log screen and per-listing badges.
syncLogRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const q = listQuerySchema.parse(req.query);

    const conditions = [eq(marketplaceSyncLog.userId, userId)];
    if (q.status) conditions.push(eq(marketplaceSyncLog.status, q.status));
    if (q.listingId) conditions.push(eq(marketplaceSyncLog.listingId, q.listingId));

    const entries = await db.select()
      .from(marketplaceSyncLog)
      .where(and(...conditions))
      .orderBy(desc(marketplaceSyncLog.createdAt))
      .limit(q.limit)
      .offset(q.offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(marketplaceSyncLog)
      .where(and(...conditions));

    res.json({ entries, total: count, limit: q.limit, offset: q.offset });
  } catch (err) {
    next(err);
  }
});
