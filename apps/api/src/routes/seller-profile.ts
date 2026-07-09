import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { sellerProfiles } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const logger = createLogger('seller-profile');

export const sellerProfileRouter = Router();

sellerProfileRouter.use(requireAuth);

sellerProfileRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    let [profile] = await db.select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      [profile] = await db.insert(sellerProfiles)
        .values({ userId })
        .returning();
      logger.info({ userId }, 'Created default seller profile');
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  ebayFulfillmentPolicyId: z.string().nullable().optional(),
  ebayPaymentPolicyId: z.string().nullable().optional(),
  ebayReturnPolicyId: z.string().nullable().optional(),
  ebayMerchantLocationKey: z.string().nullable().optional(),
  reverbOffersEnabled: z.boolean().optional(),
  reverbDefaultShipping: z.object({
    rates: z.array(z.object({
      regionCode: z.string(),
      rate: z.object({ amount: z.string(), currency: z.string() }),
    })),
    local: z.boolean(),
  }).nullable().optional(),
  shipFromAddress: z.object({
    name: z.string(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }).nullable().optional(),
  defaultWeightUnit: z.enum(['oz', 'lb', 'g', 'kg']).optional(),
  defaultDimensionUnit: z.enum(['in', 'cm']).optional(),
  defaultPackageType: z.enum(['box', 'envelope', 'poly_mailer']).optional(),
  ebayPublishMode: z.enum(['draft', 'live']).optional(),
  preferredMarketplaces: z.array(z.enum(['ebay', 'reverb'])).optional(),
  autoPublish: z.boolean().optional(),
  defaultCurrency: z.string().length(3).optional(),
  pricingSuggestPercentile: z.number().int().min(10).max(90).optional(),
  pricingFloorPercentile: z.number().int().min(5).max(75).optional(),
  bestOfferAutoAcceptEnabled: z.boolean().optional(),
  gtcAutoEnd: z.boolean().optional(),
  defaultListingFooter: z.string().max(2000).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

sellerProfileRouter.patch('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateSchema.parse(req.body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) updates[key] = value;
    }

    const [existing] = await db.select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);

    // Cross-field invariant cannot live in Zod: a partial PATCH sees only one
    // field, so merge with the stored row (or column defaults) before checking.
    if (body.pricingSuggestPercentile !== undefined || body.pricingFloorPercentile !== undefined) {
      const suggest = body.pricingSuggestPercentile ?? existing?.pricingSuggestPercentile ?? 50;
      const floor = body.pricingFloorPercentile ?? existing?.pricingFloorPercentile ?? 25;
      if (floor >= suggest) {
        throw new AppError(400, 'PRICING_FLOOR_INVALID', 'Floor percentile must be below the suggested-price percentile');
      }
    }

    let profile;
    if (existing) {
      [profile] = await db.update(sellerProfiles)
        .set(updates)
        .where(eq(sellerProfiles.userId, userId))
        .returning();
    } else {
      [profile] = await db.insert(sellerProfiles)
        .values({ userId, ...updates })
        .returning();
    }

    logger.info({ userId, updatedFields: Object.keys(body) }, 'Seller profile updated');
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

// Business Policies endpoints (GET /ebay-policies, POST /ebay/auto-setup) were
// REMOVED 2026-07-09: Trade-First publishes with inline terms (Decision 5 —
// account opted OUT of Business Policies), and the seller-profile screen no
// longer renders policy pickers or the setup button they served.
