import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, lt } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { listingDrafts } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const logger = pino({ name: 'drafts' });

const upsertDraftSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid().nullable().optional(),
  marketplace: z.enum(['ebay', 'etsy', 'reverb']),
  title: z.string().max(500).nullable().optional(),
  price: z.number().positive().nullable().optional(),
  lastStepCompleted: z.string().max(50).nullable().optional(),
  flowState: z.record(z.unknown()),
});

export const draftsRouter = Router();

draftsRouter.use(requireAuth);

draftsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const results = await db.select()
      .from(listingDrafts)
      .where(eq(listingDrafts.userId, userId))
      .orderBy(desc(listingDrafts.updatedAt));

    res.json({ drafts: results });
  } catch (err) {
    next(err);
  }
});

draftsRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [draft] = await db.select()
      .from(listingDrafts)
      .where(and(eq(listingDrafts.id, req.params.id), eq(listingDrafts.userId, userId)))
      .limit(1);

    if (!draft) throw new AppError(404, 'NOT_FOUND', 'Draft not found');
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

draftsRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = upsertDraftSchema.parse(req.body);

    if (body.id) {
      const [existing] = await db.select({ id: listingDrafts.id })
        .from(listingDrafts)
        .where(and(eq(listingDrafts.id, body.id), eq(listingDrafts.userId, userId)))
        .limit(1);

      if (existing) {
        const [updated] = await db.update(listingDrafts)
          .set({
            marketplace: body.marketplace,
            title: body.title ?? null,
            price: body.price ?? null,
            lastStepCompleted: body.lastStepCompleted ?? null,
            flowState: body.flowState,
            updatedAt: new Date(),
          })
          .where(eq(listingDrafts.id, body.id))
          .returning();

        logger.debug({ userId, draftId: updated.id }, 'Draft updated');
        res.json(updated);
        return;
      }
    }

    if (body.itemId) {
      const [existing] = await db.select({ id: listingDrafts.id })
        .from(listingDrafts)
        .where(and(
          eq(listingDrafts.userId, userId),
          eq(listingDrafts.itemId, body.itemId),
          eq(listingDrafts.marketplace, body.marketplace),
        ))
        .limit(1);

      if (existing) {
        const [updated] = await db.update(listingDrafts)
          .set({
            title: body.title ?? null,
            price: body.price ?? null,
            lastStepCompleted: body.lastStepCompleted ?? null,
            flowState: body.flowState,
            updatedAt: new Date(),
          })
          .where(eq(listingDrafts.id, existing.id))
          .returning();

        logger.debug({ userId, draftId: updated.id }, 'Draft upserted by itemId');
        res.json(updated);
        return;
      }
    }

    const [draft] = await db.insert(listingDrafts).values({
      userId,
      itemId: body.itemId ?? null,
      marketplace: body.marketplace,
      title: body.title ?? null,
      price: body.price ?? null,
      lastStepCompleted: body.lastStepCompleted ?? null,
      flowState: body.flowState,
    }).returning();

    logger.info({ userId, draftId: draft.id }, 'Draft created');
    res.status(201).json(draft);
  } catch (err) {
    next(err);
  }
});

draftsRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [existing] = await db.select({ id: listingDrafts.id })
      .from(listingDrafts)
      .where(and(eq(listingDrafts.id, req.params.id), eq(listingDrafts.userId, userId)))
      .limit(1);

    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Draft not found');

    await db.delete(listingDrafts).where(eq(listingDrafts.id, req.params.id));
    logger.info({ userId, draftId: req.params.id }, 'Draft deleted');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

draftsRouter.delete('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(listingDrafts)
      .where(and(eq(listingDrafts.userId, userId), lt(listingDrafts.updatedAt, thirtyDaysAgo)));

    logger.info({ userId }, 'Stale drafts cleaned');
    res.json({ cleaned: true });
  } catch (err) {
    next(err);
  }
});
