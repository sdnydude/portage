import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { sellerProfiles, marketplaceAccounts } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
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
  ebayPublishMode: z.enum(['draft', 'live']).optional(),
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

sellerProfileRouter.post('/ebay/auto-setup', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [account] = await db.select({ id: marketplaceAccounts.id })
      .from(marketplaceAccounts)
      .where(and(eq(marketplaceAccounts.userId, userId), eq(marketplaceAccounts.marketplace, 'ebay')))
      .limit(1);
    if (!account) {
      throw new AppError(400, 'EBAY_NOT_CONNECTED', 'Connect your eBay account before running setup.');
    }

    const token = await getEbayAccessToken(userId);
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const base = env().EBAY_SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

    // GET-first idempotency: reuse a "Portage Standard" policy by name, else create it.
    const [fRes, pRes, rRes] = await Promise.allSettled([
      fetch(`${base}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`, { headers }),
      fetch(`${base}/sell/account/v1/payment_policy?marketplace_id=EBAY_US`, { headers }),
      fetch(`${base}/sell/account/v1/return_policy?marketplace_id=EBAY_US`, { headers }),
    ]);
    const findPolicyId = async (r: PromiseSettledResult<Response>, listKey: string, name: string): Promise<string | undefined> => {
      if (r.status === 'rejected' || !r.value.ok) return undefined;
      const data = await r.value.json() as Record<string, Array<Record<string, string>>>;
      const match = (data[listKey] ?? []).find((p) => p.name === name);
      return match ? (match.fulfillmentPolicyId ?? match.paymentPolicyId ?? match.returnPolicyId) : undefined;
    };

    const adapter = new EbayAdapter(userId);

    // Fulfillment is special: reuse by name, but migrate a legacy non-CALCULATED
    // "Portage Standard Fulfillment" (e.g. the old FLAT_RATE default) to the
    // canonical buyer-paid CALCULATED shape IN PLACE (same id), so sellers who ran
    // setup before the calculated default converge without a duplicate policy.
    const resolveFulfillmentPolicyId = async (): Promise<string> => {
      const name = 'Portage Standard Fulfillment';
      if (fRes.status === 'fulfilled' && fRes.value.ok) {
        const data = await fRes.value.json() as {
          fulfillmentPolicies?: Array<{ fulfillmentPolicyId?: string; name?: string; shippingOptions?: Array<{ costType?: string }> }>;
        };
        const match = (data.fulfillmentPolicies ?? []).find((p) => p.name === name);
        if (match?.fulfillmentPolicyId) {
          const isCalculated = (match.shippingOptions ?? []).some((o) => o.costType === 'CALCULATED');
          return isCalculated ? match.fulfillmentPolicyId : adapter.updateFulfillmentPolicy(match.fulfillmentPolicyId, name);
        }
      }
      return adapter.createFulfillmentPolicy(name);
    };

    const fulfillmentPolicyId = await resolveFulfillmentPolicyId();
    const paymentPolicyId = await findPolicyId(pRes, 'paymentPolicies', 'Portage Standard Payment')
      ?? await adapter.createPaymentPolicy('Portage Standard Payment');
    const returnPolicyId = await findPolicyId(rRes, 'returnPolicies', 'Portage Standard Return')
      ?? await adapter.createReturnPolicy('Portage Standard Return');

    const [profile] = await db.select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);
    if (!profile) throw new AppError(400, 'SELLER_PROFILE_REQUIRED', 'Create a seller profile before running eBay setup.');
    const shipFrom = profile.shipFromAddress as
      { name?: string; street1?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string } | null;
    let merchantLocationKey: string | null = profile.ebayMerchantLocationKey ?? null;
    let locationConfigured = Boolean(merchantLocationKey);

    // Pull existing eBay inventory locations — if the seller already has one, use it
    // (no manual ship-from address needed). This is the "pull from eBay" path.
    if (!merchantLocationKey) {
      try {
        const locListRes = await fetch(`${base}/sell/inventory/v1/location?limit=10`, { headers });
        if (locListRes.ok) {
          const locData = await locListRes.json() as { locations?: Array<{ merchantLocationKey?: string }> };
          const existing = locData.locations?.find((l) => l.merchantLocationKey)?.merchantLocationKey;
          if (existing) {
            merchantLocationKey = existing;
            locationConfigured = true;
          }
        }
      } catch {
        // fall through to create-from-shipFrom / SHIP_FROM_REQUIRED
      }
    }

    // Still no location? Pull the seller's registration address from eBay identity and
    // use it as the ship-from — true one-click setup with no manual entry.
    let effectiveShipFrom = shipFrom;
    if (!merchantLocationKey && !effectiveShipFrom) {
      try {
        const identityHost = env().EBAY_SANDBOX ? 'https://apiz.sandbox.ebay.com' : 'https://apiz.ebay.com';
        const idRes = await fetch(`${identityHost}/commerce/identity/v1/user/`, { headers });
        if (idRes.ok) {
          const identity = await idRes.json() as {
            businessAccount?: { address?: Record<string, string> };
            individualAccount?: { registrationAddress?: Record<string, string> };
          };
          const a = identity.businessAccount?.address ?? identity.individualAccount?.registrationAddress;
          if (a && (a.postalCode || a.addressLine1)) {
            effectiveShipFrom = {
              street1: a.addressLine1, street2: a.addressLine2,
              city: a.city, state: a.stateOrProvince, zip: a.postalCode, country: a.country ?? 'US',
            };
          }
        }
      } catch {
        // fall through to SHIP_FROM_REQUIRED
      }
    }

    // eBay requires an inventory location to publish. If we still have neither a
    // ship-from (profile or eBay-pulled) nor an existing location, fail loudly so the
    // UI can collect an address — never save a half-configured setup.
    if (!effectiveShipFrom && !merchantLocationKey) {
      throw new AppError(400, 'SHIP_FROM_REQUIRED', 'Add a ship-from address to your seller profile before running eBay setup — eBay needs it to create your inventory location.');
    }

    if (effectiveShipFrom && !merchantLocationKey) {
      const key = profile.ebayMerchantLocationKey ?? 'portage-primary';
      const locRes = await fetch(`${base}/sell/inventory/v1/location/${key}`, { headers });
      if (!locRes.ok) {
        await adapter.createInventoryLocation(key, {
          ...(effectiveShipFrom.street1 ? { addressLine1: effectiveShipFrom.street1 } : {}),
          ...(effectiveShipFrom.street2 ? { addressLine2: effectiveShipFrom.street2 } : {}),
          ...(effectiveShipFrom.city ? { city: effectiveShipFrom.city } : {}),
          ...(effectiveShipFrom.state ? { stateOrProvince: effectiveShipFrom.state } : {}),
          ...(effectiveShipFrom.zip ? { postalCode: effectiveShipFrom.zip } : {}),
          country: effectiveShipFrom.country ?? 'US',
        }, effectiveShipFrom.name || 'Portage Primary');
      }
      merchantLocationKey = key;
      locationConfigured = true;
    }

    await db.update(sellerProfiles)
      .set({
        ebayFulfillmentPolicyId: fulfillmentPolicyId,
        ebayPaymentPolicyId: paymentPolicyId,
        ebayReturnPolicyId: returnPolicyId,
        ebayMerchantLocationKey: merchantLocationKey,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.userId, userId));

    res.json({ setup: { fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey, locationConfigured } });
  } catch (err) {
    next(err);
  }
});
