import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { sellerProfiles, marketplaceAccounts } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { env } from '../lib/env.js';

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
  preferredMarketplaces: z.array(z.enum(['ebay', 'etsy', 'reverb'])).optional(),
  autoPublish: z.boolean().optional(),
  defaultCurrency: z.string().length(3).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

sellerProfileRouter.patch('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateSchema.parse(req.body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) updates[key] = value;
    }

    const [existing] = await db.select({ id: sellerProfiles.id })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);

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

sellerProfileRouter.get('/ebay-policies', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [account] = await db.select()
      .from(marketplaceAccounts)
      .where(eq(marketplaceAccounts.userId, userId))
      .limit(1);

    if (!account) {
      res.json({ fulfillment: [], payment: [], returnPolicy: [] });
      return;
    }

    const token = await getEbayAccessToken(userId);
    const baseUrl = env().EBAY_SANDBOX
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const [fulfillmentRes, paymentRes, returnRes] = await Promise.allSettled([
      fetch(`${baseUrl}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`, { headers }),
      fetch(`${baseUrl}/sell/account/v1/payment_policy?marketplace_id=EBAY_US`, { headers }),
      fetch(`${baseUrl}/sell/account/v1/return_policy?marketplace_id=EBAY_US`, { headers }),
    ]);

    const extractPolicies = async (result: PromiseSettledResult<Response>, key: string) => {
      if (result.status === 'rejected') return [];
      if (!result.value.ok) return [];
      const data = await result.value.json() as Record<string, Array<{ [k: string]: string }>>;
      const policies = data[key] ?? [];
      return policies.map((p: Record<string, string>) => ({
        policyId: p.fulfillmentPolicyId ?? p.paymentPolicyId ?? p.returnPolicyId ?? p.policyId,
        name: p.name ?? 'Unnamed',
        description: p.description,
      }));
    };

    const fulfillment = await extractPolicies(fulfillmentRes, 'fulfillmentPolicies');
    const payment = await extractPolicies(paymentRes, 'paymentPolicies');
    const returnPolicy = await extractPolicies(returnRes, 'returnPolicies');

    res.json({ fulfillment, payment, returnPolicy });
  } catch (err) {
    next(err);
  }
});
