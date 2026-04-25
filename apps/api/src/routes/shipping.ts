import { Router } from 'express';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { shippingPresets, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const logger = pino({ name: 'shipping' });

export const shippingRouter = Router();

shippingRouter.use(requireAuth);

// ─── Presets ────────────────────────────────────────────────

const createPresetSchema = z.object({
  name: z.string().min(1).max(100),
  packageType: z.enum(['box', 'envelope', 'poly_mailer']),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  weightLbs: z.number().int().min(0).default(0),
  weightOz: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

const updatePresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  packageType: z.enum(['box', 'envelope', 'poly_mailer']).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  weightLbs: z.number().int().min(0).optional(),
  weightOz: z.number().min(0).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// GET /shipping/presets — list user's presets
shippingRouter.get('/presets', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const presets = await db.select()
      .from(shippingPresets)
      .where(eq(shippingPresets.userId, userId))
      .orderBy(asc(shippingPresets.sortOrder));

    res.json({ presets });
  } catch (err) {
    next(err);
  }
});

// POST /shipping/presets — create a preset
shippingRouter.post('/presets', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = createPresetSchema.parse(req.body);

    // If this preset is default, unset any existing default
    if (body.isDefault) {
      await db.update(shippingPresets)
        .set({ isDefault: false })
        .where(and(eq(shippingPresets.userId, userId), eq(shippingPresets.isDefault, true)));
    }

    const [preset] = await db.insert(shippingPresets).values({
      userId,
      name: body.name,
      packageType: body.packageType,
      length: body.length,
      width: body.width,
      height: body.height,
      weightLbs: body.weightLbs,
      weightOz: body.weightOz,
      isDefault: body.isDefault,
      sortOrder: body.sortOrder,
    }).returning();

    logger.info({ userId, presetId: preset.id }, 'Shipping preset created');

    res.status(201).json(preset);
  } catch (err) {
    next(err);
  }
});

// PUT /shipping/presets/:id — update a preset
shippingRouter.put('/presets/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updatePresetSchema.parse(req.body);

    const [existing] = await db.select({ id: shippingPresets.id })
      .from(shippingPresets)
      .where(and(eq(shippingPresets.id, req.params.id), eq(shippingPresets.userId, userId)))
      .limit(1);

    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Shipping preset not found');

    // If setting this as default, unset any existing default
    if (body.isDefault) {
      await db.update(shippingPresets)
        .set({ isDefault: false })
        .where(and(eq(shippingPresets.userId, userId), eq(shippingPresets.isDefault, true)));
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.packageType !== undefined) updates.packageType = body.packageType;
    if (body.length !== undefined) updates.length = body.length;
    if (body.width !== undefined) updates.width = body.width;
    if (body.height !== undefined) updates.height = body.height;
    if (body.weightLbs !== undefined) updates.weightLbs = body.weightLbs;
    if (body.weightOz !== undefined) updates.weightOz = body.weightOz;
    if (body.isDefault !== undefined) updates.isDefault = body.isDefault;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    const [updated] = await db.update(shippingPresets)
      .set(updates)
      .where(eq(shippingPresets.id, req.params.id))
      .returning();

    logger.info({ userId, presetId: updated.id }, 'Shipping preset updated');

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /shipping/presets/:id — delete a preset
shippingRouter.delete('/presets/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [existing] = await db.select({ id: shippingPresets.id })
      .from(shippingPresets)
      .where(and(eq(shippingPresets.id, req.params.id), eq(shippingPresets.userId, userId)))
      .limit(1);

    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Shipping preset not found');

    await db.delete(shippingPresets).where(eq(shippingPresets.id, req.params.id));

    logger.info({ userId, presetId: req.params.id }, 'Shipping preset deleted');

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
