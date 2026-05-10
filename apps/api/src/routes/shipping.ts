import { Router } from 'express';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { shippingPresets, shippingProviders, orders, users, disclaimerAcceptances, listings } from '../db/schema.js';
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

    const preset = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx.update(shippingPresets)
          .set({ isDefault: false })
          .where(and(eq(shippingPresets.userId, userId), eq(shippingPresets.isDefault, true)));
      }

      const [created] = await tx.insert(shippingPresets).values({
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

      return created;
    });

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

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: shippingPresets.id })
        .from(shippingPresets)
        .where(and(eq(shippingPresets.id, req.params.id), eq(shippingPresets.userId, userId)))
        .limit(1);

      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Shipping preset not found');

      if (body.isDefault) {
        await tx.update(shippingPresets)
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

      const [result] = await tx.update(shippingPresets)
        .set(updates)
        .where(eq(shippingPresets.id, req.params.id))
        .returning();

      return result;
    });

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

// ─── Label Purchase ─────────────────────────────────────────

const purchaseLabelSchema = z.object({
  orderId: z.string().uuid(),
  rateId: z.string().min(1),
  packageType: z.enum(['box', 'envelope', 'poly_mailer']).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  weightLbs: z.number().int().min(0).optional(),
  weightOz: z.number().min(0).optional(),
});

// POST /shipping/labels — purchase a shipping label (stub)
shippingRouter.post('/labels', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = purchaseLabelSchema.parse(req.body);

    // Verify the order belongs to this user and is in the right status
    const [order] = await db.select()
      .from(orders)
      .where(and(eq(orders.id, body.orderId), eq(orders.userId, userId)))
      .limit(1);

    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

    if (order.status !== 'payment_received') {
      throw new AppError(400, 'INVALID_STATUS', `Cannot purchase label for order in "${order.status}" status. Order must be in "payment_received" status.`);
    }

    // Stub: return preview data without mutating order state
    const trackingNumber = `STUB${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const carrier = body.rateId.includes('ups') ? 'UPS' : 'USPS';

    logger.info({ userId, orderId: order.id, carrier }, 'Label purchase requested (stub — no DB mutation)');

    res.status(200).json({
      orderId: order.id,
      trackingNumber,
      carrier,
      shippingLabelUrl: null,
      status: order.status,
      isStub: true,
      message: 'Shipping provider not configured. Connect a provider in Settings > Shipping to purchase real labels.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /shipping/labels/:orderId — get label PDF URL for an order
shippingRouter.get('/labels/:orderId', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [order] = await db.select()
      .from(orders)
      .where(and(eq(orders.id, req.params.orderId), eq(orders.userId, userId)))
      .limit(1);

    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

    if (!order.shippingLabelUrl) {
      throw new AppError(404, 'NO_LABEL', 'No shipping label has been purchased for this order');
    }

    res.json({
      orderId: order.id,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      shippingLabelUrl: order.shippingLabelUrl,
      status: order.status,
    });
  } catch (err) {
    next(err);
  }
});

// POST /shipping/orders/:id/ship — mark order as shipped
shippingRouter.post('/orders/:id/ship', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [order] = await db.select()
      .from(orders)
      .where(and(eq(orders.id, req.params.id), eq(orders.userId, userId)))
      .limit(1);

    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

    if (order.status !== 'label_purchased') {
      throw new AppError(400, 'INVALID_STATUS', `Cannot mark order as shipped from "${order.status}" status. Order must have a purchased label first.`);
    }

    const [updated] = await db.update(orders)
      .set({
        status: 'shipped',
        shippedAt: new Date(),
      })
      .where(eq(orders.id, req.params.id))
      .returning();

    logger.info({ userId, orderId: updated.id, trackingNumber: updated.trackingNumber }, 'Order marked as shipped');

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── Disclaimer Acceptance ──────────────────────────────────

const CURRENT_DISCLAIMER_VERSION = 1;

const acceptTermsSchema = z.object({
  disclaimerVersion: z.number().int().positive().optional(),
});

// POST /shipping/listings/:id/accept-terms — record disclaimer acceptance
shippingRouter.post('/listings/:id/accept-terms', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = acceptTermsSchema.parse(req.body);
    const version = body.disclaimerVersion ?? CURRENT_DISCLAIMER_VERSION;

    // Verify the listing belongs to this user
    const [listing] = await db.select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .limit(1);

    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');

    // Get client IP (handles proxied requests)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || null;

    const [acceptance] = await db.insert(disclaimerAcceptances).values({
      userId,
      listingId: req.params.id,
      disclaimerVersion: version,
      ipAddress: ipAddress?.slice(0, 45) ?? null,
    }).returning();

    logger.info({ userId, listingId: req.params.id, version, ipAddress }, 'Disclaimer accepted');

    res.status(201).json(acceptance);
  } catch (err) {
    next(err);
  }
});

// GET /shipping/disclaimer/version — get current disclaimer version
shippingRouter.get('/disclaimer/version', async (_req, res, next) => {
  try {
    res.json({
      version: CURRENT_DISCLAIMER_VERSION,
      effectiveDate: '2026-04-25',
    });
  } catch (err) {
    next(err);
  }
});

// ─── Ship-From Address ──────────────────────────────────────

const shipFromAddressSchema = z.object({
  name: z.string().min(1).max(255),
  street1: z.string().min(1).max(255),
  street2: z.string().max(255).optional(),
  city: z.string().min(1).max(255),
  state: z.string().min(2).max(2),
  zip: z.string().min(5).max(10),
  country: z.string().min(2).max(2).default('US'),
});

const shippingSettingsSchema = z.object({
  shipFromAddress: shipFromAddressSchema.optional(),
  shippingAutoMark: z.boolean().optional(),
});

// GET /shipping/settings — get user's shipping settings
shippingRouter.get('/settings', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [user] = await db.select({
      shipFromAddress: users.shipFromAddress,
      shippingAutoMark: users.shippingAutoMark,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    res.json({
      shipFromAddress: user.shipFromAddress,
      shippingAutoMark: user.shippingAutoMark,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /shipping/settings — update user's shipping settings
shippingRouter.put('/settings', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = shippingSettingsSchema.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.shipFromAddress !== undefined) updates.shipFromAddress = body.shipFromAddress;
    if (body.shippingAutoMark !== undefined) updates.shippingAutoMark = body.shippingAutoMark;

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'NO_UPDATES', 'No valid fields to update');
    }

    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        shipFromAddress: users.shipFromAddress,
        shippingAutoMark: users.shippingAutoMark,
      });

    logger.info({ userId }, 'Shipping settings updated');

    res.json({
      shipFromAddress: updated.shipFromAddress,
      shippingAutoMark: updated.shippingAutoMark,
    });
  } catch (err) {
    next(err);
  }
});
