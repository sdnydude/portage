import { Router, type Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { marketplaceSyncLog, syncJobs, listings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { enqueueItemSync } from '../lib/sync-worker.js';

export const syncLogRouter = Router();
syncLogRouter.use(requireAuth);

// Retry drives real eBay/Reverb calls through the worker (audit M8) — the
// only unlimited externally-consequential route until now. Keyed per user
// (billing.ts pattern); IPv6 subnet fallback for the unauthenticated edge.
const retryLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 5 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.sub ?? (req.ip ? ipKeyGenerator(req.ip) : 'unknown'),
  message: { error: 'Too many sync retries, please wait a few minutes', code: 'RATE_LIMITED' },
});

const statusQuerySchema = z.object({
  // UUID-validated (audit m4): a malformed id would otherwise surface as a
  // Postgres "invalid input syntax for type uuid" 500 instead of a clean 400.
  listingIds: z.string().min(1)
    .transform((s) => s.split(',').filter(Boolean).slice(0, 50))
    .refine((ids) => ids.every((id) => z.string().uuid().safeParse(id).success), {
      message: 'listingIds must be UUIDs',
    }),
});

// Per-listing badge state for the P3 truth surface. Two sources feed it:
// sync_jobs (outbox item-edit syncs) and marketplace_sync_log (inline
// listings.ts syncs — price/shipping/archive/publish — which never create
// jobs; audit C1). An in-flight job wins for its listing; otherwise the
// newest row across both sources does. Listings with no history in either
// are omitted — the UI shows no badge for never-synced rows.
syncLogRouter.get('/status', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const q = statusQuerySchema.parse(req.query);

    const jobs = await db.select()
      .from(syncJobs)
      .where(and(eq(syncJobs.userId, userId), inArray(syncJobs.listingId, q.listingIds)))
      // id tiebreaker (audit m5): equal timestamps must not resolve in
      // arbitrary Postgres order — the badge would flip across requests.
      .orderBy(desc(syncJobs.updatedAt), desc(syncJobs.id));

    const logRows = await db.select()
      .from(marketplaceSyncLog)
      .where(and(eq(marketplaceSyncLog.userId, userId), inArray(marketplaceSyncLog.listingId, q.listingIds)))
      .orderBy(desc(marketplaceSyncLog.createdAt), desc(marketplaceSyncLog.id));

    type Candidate = { state: 'pending' | 'failed' | 'synced'; at: Date; message?: string; photos?: boolean };
    const jobsByListing = new Map<string, typeof jobs>();
    for (const job of jobs) {
      const rows = jobsByListing.get(job.listingId);
      if (rows) rows.push(job);
      else jobsByListing.set(job.listingId, [job]);
    }
    const newestJob = new Map<string, Candidate>();
    for (const [listingId, rows] of jobsByListing) {
      const newest = rows[0]; // rows arrive updatedAt DESC
      if (newest.status === 'pending' || newest.status === 'running') {
        newestJob.set(listingId, { state: 'pending', at: newest.updatedAt });
        continue;
      }
      // Audit C2: a failed job stays visible until a later success covers its
      // scope — a photo-less success does not resolve a failed photo job.
      let sawFullSuccess = false;
      let sawPartialSuccess = false;
      let unresolved: (typeof rows)[number] | undefined;
      for (const row of rows) {
        if (row.status === 'success') {
          if (row.includePhotos) sawFullSuccess = true;
          else sawPartialSuccess = true;
        } else if (row.status === 'failed' && !unresolved) {
          if (!(sawFullSuccess || (sawPartialSuccess && !row.includePhotos))) unresolved = row;
        }
      }
      if (unresolved) {
        newestJob.set(listingId, {
          state: 'failed',
          at: unresolved.updatedAt,
          photos: unresolved.includePhotos,
          ...(unresolved.lastError ? { message: unresolved.lastError } : {}),
        });
      } else {
        newestJob.set(listingId, { state: 'synced', at: newest.updatedAt });
      }
    }
    const newestLog = new Map<string, Candidate>();
    for (const row of logRows) {
      if (!row.listingId || newestLog.has(row.listingId)) continue;
      const state = row.status === 'failure' ? 'failed' : 'synced';
      newestLog.set(row.listingId, {
        state,
        at: row.createdAt,
        ...(state === 'failed' && row.message ? { message: row.message } : {}),
      });
    }

    const statuses: Array<{ listingId: string; state: 'pending' | 'failed' | 'synced'; lastAttemptAt: string; message?: string }> = [];
    for (const listingId of new Set([...newestJob.keys(), ...newestLog.keys()])) {
      const job = newestJob.get(listingId);
      const log = newestLog.get(listingId);
      let winner: Candidate;
      if (job?.state === 'pending') {
        winner = job;
      } else if (job?.state === 'failed') {
        // Audit C2: an inline-log success clears a job failure only when it
        // covers its scope — inline syncs never push photos.
        if (log && log.at > job.at && (log.state === 'failed' || !job.photos)) winner = log;
        else winner = job;
      } else if (!job) {
        winner = log!;
      } else if (!log) {
        winner = job;
      } else {
        winner = log.at > job.at ? log : job;
      }
      statuses.push({
        listingId,
        state: winner.state,
        lastAttemptAt: winner.at.toISOString(),
        ...(winner.message ? { message: winner.message } : {}),
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
syncLogRouter.post('/retry', retryLimiter, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = retryBodySchema.parse(req.body);

    const [listing] = await db.select()
      .from(listings)
      .where(and(eq(listings.id, body.listingId), eq(listings.userId, userId)))
      .limit(1);
    // Status gate mirrors the items.ts sync loop (audit M5): only live rows
    // sync — retrying a sold/archived listing would revise an ended
    // marketplace listing and burn the worker's backoff attempts. eBay
    // additionally requires an active (published) listing to revise.
    const syncable = !!listing?.marketplaceListingId
      && ['active', 'draft'].includes(listing.status)
      && !(listing.marketplace === 'ebay' && listing.status !== 'active');
    if (!listing || !syncable) {
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
