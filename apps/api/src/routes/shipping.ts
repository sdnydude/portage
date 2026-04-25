import { Router } from 'express';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { shippingPresets, shippingProviders, orders, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { encrypt, decrypt } from '../lib/crypto.js';

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

// ─── Provider Management ────────────────────────────────────

const setProviderSchema = z.object({
  provider: z.enum(['shippo', 'easypost', 'pirate_ship']),
  apiKey: z.string().min(1, 'API key is required'),
  isActive: z.boolean().default(true),
});

const PROVIDER_KEY_PATTERNS: Record<string, RegExp> = {
  shippo: /^shippo_(test|live)_[a-f0-9]{40}$/,
  easypost: /^EZ[A-Za-z0-9]{58}$/,
  pirate_ship: /^.{8,}$/,
};

// GET /shipping/provider — get user's configured provider (without decrypted key)
shippingRouter.get('/provider', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [provider] = await db.select()
      .from(shippingProviders)
      .where(and(eq(shippingProviders.userId, userId), eq(shippingProviders.isActive, true)))
      .limit(1);

    if (!provider) {
      res.json({ provider: null });
      return;
    }

    // Return provider info without the encrypted API key
    res.json({
      provider: {
        id: provider.id,
        provider: provider.provider,
        isActive: provider.isActive,
        createdAt: provider.createdAt,
        hasApiKey: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /shipping/provider — set or update the shipping provider
shippingRouter.put('/provider', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = setProviderSchema.parse(req.body);

    const apiKeyEncrypted = encrypt(body.apiKey);

    // Upsert: deactivate any existing providers, then insert new one
    await db.update(shippingProviders)
      .set({ isActive: false })
      .where(eq(shippingProviders.userId, userId));

    const [provider] = await db.insert(shippingProviders).values({
      userId,
      provider: body.provider,
      apiKeyEncrypted,
      isActive: body.isActive,
    }).returning();

    logger.info({ userId, provider: body.provider }, 'Shipping provider configured');

    res.json({
      provider: {
        id: provider.id,
        provider: provider.provider,
        isActive: provider.isActive,
        createdAt: provider.createdAt,
        hasApiKey: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /shipping/provider/test — test provider connection (format validation only for now)
shippingRouter.post('/provider/test', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [provider] = await db.select()
      .from(shippingProviders)
      .where(and(eq(shippingProviders.userId, userId), eq(shippingProviders.isActive, true)))
      .limit(1);

    if (!provider) {
      throw new AppError(404, 'NO_PROVIDER', 'No shipping provider configured');
    }

    // Decrypt and validate format
    const apiKey = decrypt(provider.apiKeyEncrypted);
    const pattern = PROVIDER_KEY_PATTERNS[provider.provider];
    const formatValid = pattern ? pattern.test(apiKey) : apiKey.length >= 8;

    logger.info({ userId, provider: provider.provider, formatValid }, 'Shipping provider test');

    res.json({
      provider: provider.provider,
      formatValid,
      message: formatValid
        ? 'API key format is valid. Live connection test will be available when provider integration is complete.'
        : 'API key format does not match expected pattern. Please verify your key.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── Rate Fetching ──────────────────────────────────────────

const getRatesSchema = z.object({
  orderId: z.string().uuid(),
  packageType: z.enum(['box', 'envelope', 'poly_mailer']).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  weightLbs: z.number().int().min(0).optional(),
  weightOz: z.number().min(0).optional(),
});

// GET /shipping/rates — get rates for an order (stub: returns mock marketplace rates)
shippingRouter.get('/rates', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    // Parse query params as the schema expects
    const params = getRatesSchema.parse({
      orderId: req.query.orderId,
      packageType: req.query.packageType,
      length: req.query.length ? Number(req.query.length) : undefined,
      width: req.query.width ? Number(req.query.width) : undefined,
      height: req.query.height ? Number(req.query.height) : undefined,
      weightLbs: req.query.weightLbs ? Number(req.query.weightLbs) : undefined,
      weightOz: req.query.weightOz ? Number(req.query.weightOz) : undefined,
    });

    // Verify the order belongs to this user
    const [order] = await db.select()
      .from(orders)
      .where(and(eq(orders.id, params.orderId), eq(orders.userId, userId)))
      .limit(1);

    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

    // Stub rates — marketplace-native rates based on the order's marketplace
    const marketplace = order.marketplace;
    const stubRates = [
      {
        rateId: `${marketplace}-ground-${order.id.slice(0, 8)}`,
        carrier: marketplace === 'ebay' ? 'USPS' : 'USPS',
        service: 'Ground Advantage',
        price: 5.99,
        currency: 'USD',
        estimatedDays: 5,
        source: 'marketplace' as const,
      },
      {
        rateId: `${marketplace}-priority-${order.id.slice(0, 8)}`,
        carrier: 'USPS',
        service: 'Priority Mail',
        price: 8.49,
        currency: 'USD',
        estimatedDays: 3,
        source: 'marketplace' as const,
      },
      {
        rateId: `${marketplace}-express-${order.id.slice(0, 8)}`,
        carrier: 'USPS',
        service: 'Priority Mail Express',
        price: 26.95,
        currency: 'USD',
        estimatedDays: 1,
        source: 'marketplace' as const,
      },
      {
        rateId: `${marketplace}-ups-ground-${order.id.slice(0, 8)}`,
        carrier: 'UPS',
        service: 'Ground',
        price: 9.99,
        currency: 'USD',
        estimatedDays: 5,
        source: 'marketplace' as const,
      },
    ];

    // Check if user has a third-party provider configured
    const [provider] = await db.select()
      .from(shippingProviders)
      .where(and(eq(shippingProviders.userId, userId), eq(shippingProviders.isActive, true)))
      .limit(1);

    // If provider configured, add stub third-party rates for side-by-side comparison
    const thirdPartyRates = provider ? [
      {
        rateId: `${provider.provider}-ground-${order.id.slice(0, 8)}`,
        carrier: 'USPS',
        service: 'Ground Advantage',
        price: 5.49,
        currency: 'USD',
        estimatedDays: 5,
        source: provider.provider as 'shippo' | 'easypost' | 'pirate_ship',
      },
      {
        rateId: `${provider.provider}-priority-${order.id.slice(0, 8)}`,
        carrier: 'USPS',
        service: 'Priority Mail',
        price: 7.99,
        currency: 'USD',
        estimatedDays: 3,
        source: provider.provider as 'shippo' | 'easypost' | 'pirate_ship',
      },
    ] : [];

    logger.info({ userId, orderId: params.orderId, rateCount: stubRates.length + thirdPartyRates.length }, 'Rates fetched (stub)');

    res.json({
      orderId: params.orderId,
      rates: [...stubRates, ...thirdPartyRates],
      isStub: true,
    });
  } catch (err) {
    next(err);
  }
});
