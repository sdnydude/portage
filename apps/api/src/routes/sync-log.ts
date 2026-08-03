import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { marketplaceSyncLog } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

export const syncLogRouter = Router();
syncLogRouter.use(requireAuth);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['success', 'failure']).optional(),
  listingId: z.string().uuid().optional(),
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
