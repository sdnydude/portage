import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, ilike, and, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const logger = pino({ name: 'items' });

const photoSchema = z.object({
  url: z.string(),
  key: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  isPrimary: z.boolean().optional(),
});

const createItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.string().max(255).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  conditionNotes: z.string().max(500).optional(),
  brand: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  features: z.array(z.string().max(100)).max(30).optional(),
  estimatedValueMin: z.number().min(0).optional(),
  estimatedValueMax: z.number().min(0).optional(),
  estimatedValueRecommended: z.number().min(0).optional(),
  aiConfidenceScore: z.number().min(0).max(1).optional(),
  photos: z.array(photoSchema).optional(),
});

const updateItemSchema = createItemSchema.partial();

const listQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const itemsRouter = Router();

itemsRouter.use(requireAuth);

itemsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const query = listQuerySchema.parse(req.query);

    const conditions = [eq(items.userId, userId)];
    if (query.search) {
      conditions.push(ilike(items.title, `%${query.search}%`));
    }
    if (query.category) {
      conditions.push(eq(items.category, query.category));
    }
    if (query.condition) {
      conditions.push(eq(items.condition, query.condition));
    }

    const [results, countResult] = await Promise.all([
      db.select().from(items)
        .where(and(...conditions))
        .orderBy(desc(items.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)` }).from(items)
        .where(and(...conditions)),
    ]);

    logger.debug({ userId, count: results.length, total: countResult[0].count }, 'Items listed');

    res.json({
      items: results,
      total: Number(countResult[0].count),
      limit: query.limit,
      offset: query.offset,
    });
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [item] = await db.select().from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = createItemSchema.parse(req.body);

    const [item] = await db.insert(items).values({
      userId,
      title: body.title,
      description: body.description ?? '',
      category: body.category ?? '',
      condition: body.condition ?? 'good',
      conditionNotes: body.conditionNotes ?? '',
      brand: body.brand ?? '',
      model: body.model ?? '',
      features: body.features ?? [],
      estimatedValueMin: body.estimatedValueMin ?? null,
      estimatedValueMax: body.estimatedValueMax ?? null,
      estimatedValueRecommended: body.estimatedValueRecommended ?? null,
      aiConfidenceScore: body.aiConfidenceScore ?? 0,
      photos: body.photos ?? [],
    }).returning();

    logger.info({ userId, itemId: item.id, title: item.title }, 'Item created');
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateItemSchema.parse(req.body);

    const [existing] = await db.select({ id: items.id }).from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    const [updated] = await db.update(items)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(items.id, req.params.id))
      .returning();

    logger.info({ userId, itemId: updated.id }, 'Item updated');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

itemsRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [existing] = await db.select({ id: items.id }).from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    await db.delete(items).where(eq(items.id, req.params.id));

    logger.info({ userId, itemId: req.params.id }, 'Item deleted');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
