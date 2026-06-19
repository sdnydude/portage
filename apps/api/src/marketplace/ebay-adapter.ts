import { createLogger } from '../lib/logger.js';
import { computePriceBands } from '../lib/pricing.js';
import { env } from '../lib/env.js';
import { AppError } from '../middleware/error.js';
import { getEbayAccessToken, getEbayProdAppToken, invalidateEbayProdAppToken } from './token-manager.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
  CompListing,
  CompResult,
  EbayPreparedFields,
} from '@portage/shared';

const logger = createLogger('ebay-adapter');

// TTL caches for per-category taxonomy lookups (mirrors the Etsy shopId/taxonomy
// cache pattern). Keyed by categoryId; only successful (HTTP ok) responses are
// cached so a transient eBay error never poisons the cache for the TTL window.
const validConditionsCache = new Map<string, { value: string[]; cachedAt: number }>();
const VALID_CONDITIONS_TTL = 60 * 60 * 1000; // 1h
const requiredAspectsCache = new Map<string, { value: Record<string, { required: boolean; values: string[] | null; cardinality: 'SINGLE' | 'MULTI' }>; cachedAt: number }>();
const REQUIRED_ASPECTS_TTL = 24 * 60 * 60 * 1000; // 24h

// Test seam: module-level caches survive across vitest tests in a file.
export function clearEbayTaxonomyCaches(): void {
  validConditionsCache.clear();
  requiredAspectsCache.clear();
}

/**
 * Thrown when a listing cannot publish because one or more category-required
 * eBay item specifics (aspects) have no value. Carries the missing aspect names
 * and their allowed values so the caller can collect them from the user, rather
 * than letting eBay reject the publish with the opaque error 25002.
 */
export class EbayAspectsRequiredError extends AppError {
  constructor(public readonly missing: Array<{ name: string; values: string[] | null }>) {
    super(
      422,
      'EBAY_ASPECTS_REQUIRED',
      `eBay needs these item specifics filled in: ${missing.map((m) => m.name).join(', ')}`,
      missing,
    );
    this.name = 'EbayAspectsRequiredError';
  }
}

/**
 * Thrown when publishing to a CALCULATED-shipping fulfillment policy without a
 * package weight + dimensions, which eBay otherwise rejects with the opaque
 * error 25020. The route surfaces this as a structured 422 so the UI can prompt
 * the seller to fill weight/dimensions instead of failing the publish blindly.
 */
export class EbayWeightRequiredError extends AppError {
  constructor() {
    super(
      422,
      'EBAY_WEIGHT_REQUIRED',
      'eBay calculated shipping needs a package weight and dimensions. Add them before publishing.',
    );
    this.name = 'EbayWeightRequiredError';
  }
}

const BROWSE_CONDITION_NORMALIZE: Record<string, string> = {
  'New': 'NEW',
  'New other (see details)': 'NEW',
  'New with defects': 'LIKE_NEW',
  'New with tags': 'NEW',
  'New without tags': 'LIKE_NEW',
  'Certified - Refurbished': 'LIKE_NEW',
  'Seller refurbished': 'LIKE_NEW',
  'Excellent - Refurbished': 'LIKE_NEW',
  'Very Good - Refurbished': 'VERY_GOOD',
  'Good - Refurbished': 'GOOD',
  'Like New': 'LIKE_NEW',
  'Very Good': 'VERY_GOOD',
  'Good': 'GOOD',
  'Acceptable': 'ACCEPTABLE',
  'For parts or not working': 'ACCEPTABLE',
};

function normalizeEbayCondition(raw: string | undefined): string {
  if (!raw) return 'UNKNOWN';
  return BROWSE_CONDITION_NORMALIZE[raw] ?? raw.toUpperCase().replace(/\s+/g, '_');
}

// Portage condition → eBay Inventory API ConditionEnum (used-goods defaults).
// Media categories (books/music/movies/games) use a different condition set;
// T6's per-category validation corrects those before publish.
const CONDITION_MAP: Record<string, string> = {
  new: 'NEW',
  like_new: 'USED_EXCELLENT',
  good: 'USED_GOOD',
  fair: 'USED_ACCEPTABLE',
  poor: 'USED_ACCEPTABLE',
};

export function resolveEbayCondition(
  condition: string,
  specific?: Record<string, unknown>,
): string {
  // An explicit, already-valid eBay enum (e.g. from per-category validation) wins.
  const override = specific?.condition;
  if (typeof override === 'string' && override.length > 0) return override;
  return CONDITION_MAP[condition] ?? 'USED_GOOD';
}

// eBay represents item condition two ways: the Inventory API createListing call
// sends ConditionEnum strings (NEW, USED_GOOD…), while the Metadata
// get_item_condition_policies call returns numeric conditionId strings
// (1000, 5000…). Per-category validation must bridge the two vocabularies.
export const EBAY_CONDITION_ID_TO_ENUM: Record<string, string> = {
  '1000': 'NEW',
  '1500': 'NEW_OTHER',
  '1750': 'NEW_WITH_DEFECTS',
  '2000': 'CERTIFIED_REFURBISHED',
  '2500': 'SELLER_REFURBISHED',
  '2750': 'LIKE_NEW',
  '3000': 'USED_EXCELLENT',
  '4000': 'USED_VERY_GOOD',
  '5000': 'USED_GOOD',
  '6000': 'USED_ACCEPTABLE',
  '7000': 'FOR_PARTS_OR_NOT_WORKING',
};

// For each Portage condition, the conditionIds to try in preference order; the
// first one the target category actually supports wins. 3000 (USED_EXCELLENT)
// doubles as the generic "Used" grade most categories accept, so every used
// grade resolves in general categories while media/apparel get their granular
// grade. Conservative bias: never auto-upgrade a used item past generic Used.
const CONDITION_PREFERENCE_CHAINS: Record<string, string[]> = {
  new: ['1000', '1500'],
  like_new: ['2750', '3000', '4000'],
  good: ['5000', '3000', '4000', '6000'],
  fair: ['6000', '3000', '5000'],
  poor: ['6000', '3000', '5000'],
};

// Snap a Portage condition to the closest eBay grade a category supports.
// Returns null when no preferred grade is offered (including an empty list); the
// caller decides whether that means "ignore" (Metadata API gave nothing) or
// "warn" (the category genuinely lacks a matching grade).
export function selectValidEbayCondition(
  portageCondition: string,
  validConditionIds: string[],
): { condition: string; conditionId: string } | null {
  const chain = CONDITION_PREFERENCE_CHAINS[portageCondition];
  if (!chain) return null;
  const supported = new Set(validConditionIds);
  for (const conditionId of chain) {
    if (supported.has(conditionId)) {
      const condition = EBAY_CONDITION_ID_TO_ENUM[conditionId];
      if (condition) return { condition, conditionId };
    }
  }
  return null;
}

export function resolveEbayCategoryCondition(
  portageCondition: string,
  validConditionIds: string[],
): { condition?: string; warning?: string } {
  if (validConditionIds.length === 0) return {};
  const selected = selectValidEbayCondition(portageCondition, validConditionIds);
  if (!selected) {
    return {
      warning: `This eBay category doesn't offer a condition for a "${portageCondition}" item — review the condition before publishing.`,
    };
  }
  if (selected.condition !== resolveEbayCondition(portageCondition)) {
    return {
      condition: selected.condition,
      warning: `eBay condition set to "${selected.condition}" — the closest grade this category accepts for a "${portageCondition}" item.`,
    };
  }
  return { condition: selected.condition };
}

export interface EbayListingFields {
  categoryId: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

export function validateEbayListingFields(specific: Record<string, unknown>): EbayListingFields {
  const categoryId = specific.categoryId as string | undefined;
  if (!categoryId || categoryId === '99') {
    throw new AppError(400, 'EBAY_CATEGORY_REQUIRED', 'A valid eBay leaf category is required to list this item.');
  }
  const merchantLocationKey = specific.merchantLocationKey as string | undefined;
  const fulfillmentPolicyId = specific.fulfillmentPolicyId as string | undefined;
  const paymentPolicyId = specific.paymentPolicyId as string | undefined;
  const returnPolicyId = specific.returnPolicyId as string | undefined;
  if (!merchantLocationKey || !fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new AppError(400, 'EBAY_SETUP_REQUIRED', 'eBay selling is not set up. Run "Set up eBay Selling" in Settings first.');
  }
  return { categoryId, merchantLocationKey, fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
}

/**
 * Resolve the eBay leaf categoryId needed to publish, self-healing when it is missing.
 * Priority: an explicit categoryId already on the listing/offer (preserves user/listing
 * intent — never overridden) → the item's cached marketplaceData.ebay.categoryId → a live
 * eBay Taxonomy API suggestion from the item title. `newlyResolved` is true only when the
 * live API produced it, signalling the caller to persist it onto the item so the next
 * publish is instant. (categoryId '99' is eBay's "unset" placeholder and is treated as missing.)
 */
export async function resolveEbayCategoryId(
  marketplaceSpecific: Record<string, unknown> | undefined,
  item: { title: string; marketplaceData?: unknown },
): Promise<{ categoryId: string | null; categoryName: string | null; newlyResolved: boolean }> {
  const explicit = marketplaceSpecific?.categoryId as string | undefined;
  if (explicit && explicit !== '99') {
    return { categoryId: explicit, categoryName: null, newlyResolved: false };
  }

  const cached = (item.marketplaceData as { ebay?: { categoryId?: string; categoryName?: string } } | null | undefined)?.ebay;
  if (cached?.categoryId && cached.categoryId !== '99') {
    return { categoryId: cached.categoryId, categoryName: cached.categoryName ?? null, newlyResolved: false };
  }

  const suggestion = await EbayAdapter.getCategorySuggestion(item.title);
  return {
    categoryId: suggestion?.categoryId ?? null,
    categoryName: suggestion?.categoryName ?? null,
    newlyResolved: !!suggestion?.categoryId,
  };
}

// Identifies Portage as a registered eBay application on every API call. An
// anonymous Node `fetch` (no User-Agent) reads as a script to eBay's bot/ATO
// layer; a descriptive UA removes that signal. Used by request() and the direct
// Browse/Taxonomy fetches alike.
export const EBAY_USER_AGENT = 'PortageApp/1.0 (+https://portage.digitalharmonyai.com)';

export class EbayAdapter implements MarketplaceAdapter {
  readonly marketplace = 'ebay' as const;

  constructor(private readonly userId: string) {}

  private baseUrl(): string {
    return env().EBAY_SANDBOX
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getEbayAccessToken(this.userId);

    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': EBAY_USER_AGENT,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
        // eBay's Inventory API validates Accept-Language on inventory_item/offer
        // calls and rejects requests without an explicit, valid value (error 25709).
        'Accept-Language': 'en-US',
        ...options.headers as Record<string, string>,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, path, body: errorBody, requestBody: typeof options.body === 'string' ? options.body : undefined }, 'eBay API error');
      let longMessage: string | undefined;
      let ebayErrorIds: number[] | undefined;
      try {
        const parsed = JSON.parse(errorBody) as { errors?: Array<{ errorId?: number; longMessage?: string; message?: string }> };
        // eBay can return several errors; keep them ALL — callers that match on
        // the message (e.g. the best-offer retry) must not depend on array order.
        const messages = (parsed.errors ?? []).map(e => e.longMessage ?? e.message).filter(Boolean);
        if (messages.length > 0) longMessage = messages.join(' | ');
        ebayErrorIds = (parsed.errors ?? []).map(e => e.errorId).filter((id): id is number => typeof id === 'number');
      } catch {
        // Non-JSON error body (e.g. an HTML 5xx page) — fall back to the generic message.
      }
      const sanitized = longMessage?.replace(/<[^>]*>/g, '') ?? `eBay API error: ${response.status} on ${path}`;
      throw new AppError(response.status, 'EBAY_API_ERROR', sanitized,
        ebayErrorIds?.length ? { ebayErrorIds } : undefined);
    }

    if (response.status === 204) return {} as T;

    return response.json() as Promise<T>;
  }

  /**
   * Best-Offer auto-accept terms for an offer body. eBay nests bestOfferTerms
   * under listingPolicies (NOT beside pricingSummary) and requires the
   * autoAcceptPrice value as a STRING, mirroring pricingSummary formatting.
   * Returns {} (spread no-op) unless the floor is a positive number below the
   * BIN price — the inversion guard for prices edited after prepare time.
   */
  /**
   * Heuristic for "eBay rejected this because of Best Offer" — drives the
   * retry-without-bestOfferTerms fallback. eBay publishes no stable error id
   * for category-level Best Offer support, so this matches prose across ALL
   * returned error messages (request() joins them) including hyphenated and
   * auto-accept phrasings. errorIds are logged at the call sites to allow
   * tightening this to id-based matching once real rejections are observed.
   */
  private static isBestOfferRejection(err: unknown): boolean {
    return err instanceof Error && /best[\s-]?offer|auto[\s-]?accept/i.test(err.message);
  }

  /**
   * "eBay rejected this offer POST because one already exists for the SKU"
   * (error 25002). Drives the reuse-existing-offer recovery so a stable-SKU
   * retry doesn't fail or churn a duplicate offer.
   */
  private static isOfferExistsError(err: unknown): boolean {
    // eBay reuses errorId 25002 for several distinct "user errors" (e.g. a
    // missing item specific), so match the duplicate-offer phrasing rather than
    // the id — matching the id would false-positive and swallow a real error.
    return err instanceof AppError && /already exists/i.test(err.message);
  }

  private static bestOfferTerms(
    specific: Record<string, unknown>,
    price: number,
    currency: string,
  ): Record<string, unknown> {
    // Typed read binds the key to EbayPreparedFields.bestOfferAutoAcceptPrice —
    // a rename/typo becomes a compile error instead of silent "no Best Offer".
    const floor = (specific as Partial<EbayPreparedFields>).bestOfferAutoAcceptPrice;
    if (typeof floor !== 'number' || floor <= 0 || floor >= price) return {};
    return {
      bestOfferTerms: {
        bestOfferEnabled: true,
        autoAcceptPrice: { currency, value: String(floor) },
      },
    };
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    const sku = input.ebaySku ?? `portage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const specific = input.marketplaceSpecific ?? {};
    let ebayCondition = resolveEbayCondition(input.condition, specific);
    const fields = validateEbayListingFields(specific);

    // Calculated shipping requires a package weight + dimensions (eBay error
    // 25020). Gate pre-flight with a clear 422 instead of eBay's opaque reject.
    // Drafts are exempt — eBay only enforces this at live publish (mirrors the
    // aspects gate). Only fetch the policy when weight/dims are absent or invalid
    // — the happy path adds no extra API call.
    if (input.publishMode !== 'draft') {
      const rawWeight = specific.weight as { value?: unknown } | undefined;
      const weightOk = typeof rawWeight?.value === 'number' && rawWeight.value > 0;
      const d = specific.dimensions as { length?: number; width?: number; height?: number } | undefined;
      const dimsOk = !!d && (d.length ?? 0) > 0 && (d.width ?? 0) > 0 && (d.height ?? 0) > 0;
      if ((!weightOk || !dimsOk) && (await this.getFulfillmentPolicy(fields.fulfillmentPolicyId))) {
        throw new EbayWeightRequiredError();
      }
    }

    const product: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      imageUrls: input.photos.map((p) => p.url),
    };

    if (input.brand) product.brand = input.brand;
    if (input.model) product.mpn = input.model;
    if (specific.upc) product.upc = [specific.upc as string];
    if (specific.epid) product.epid = specific.epid;

    // eBay validates category-required item specifics from `aspects` (not the
    // legacy product.brand/mpn fields), so a missing Brand aspect fails publish
    // with error 25002. Surface Brand/Model here, but let explicit AI-prepared
    // aspects win — curated values are authoritative over the derived fallbacks.
    // Normalize aspect values to eBay's array-of-strings shape — the
    // prepare-listing AI sometimes emits a single string per aspect, which
    // previously crashed the publish path (.filter on a string).
    const rawAspects = (specific.aspects as Record<string, unknown> | undefined) ?? {};
    const aspects: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(rawAspects)) {
      const arr = (Array.isArray(v) ? v : [v])
        .map((x) => (typeof x === 'number' || typeof x === 'boolean' ? String(x) : x))
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '');
      if (arr.length > 0) {
        aspects[k] = arr;
      } else {
        // Dropping silently would resurface as a misleading "missing aspect"
        // error at the publish gate — make the discard observable.
        logger.warn({ aspect: k }, 'Discarded non-string aspect value from marketplaceSpecific.aspects');
      }
    }
    if (input.brand && !aspects.Brand) aspects.Brand = [input.brand];
    if (input.model && !aspects.Model) aspects.Model = [input.model];

    // Publish gate: eBay rejects publish (error 25002) when a category-required
    // item specific has no value. Check here — before any inventory/offer write
    // — so the caller can collect the missing specifics from the user instead of
    // creating a dead offer and surfacing eBay's opaque error. We also canonicalize
    // each value under eBay's exact aspect name (matching is case-insensitive) and
    // collapse SINGLE-cardinality aspects to one value, since eBay rejects extras.
    if (input.publishMode !== 'draft') {
      const required = await EbayAdapter.getRequiredAspects(fields.categoryId);
      const byLower = new Map(Object.keys(aspects).map((k) => [k.toLowerCase(), k]));
      const missing: Array<{ name: string; values: string[] | null }> = [];
      const canonical: Record<string, string[]> = {};

      for (const [name, meta] of Object.entries(required)) {
        const ourKey = byLower.get(name.toLowerCase());
        const vals = ourKey ? aspects[ourKey].filter((v) => v && v.trim()) : [];
        if (vals.length === 0) {
          if (meta.required) missing.push({ name, values: meta.values });
          continue;
        }
        canonical[name] = meta.cardinality === 'MULTI' ? vals : [vals[0]];
        byLower.delete(name.toLowerCase());
      }
      if (missing.length > 0) throw new EbayAspectsRequiredError(missing);

      // Preserve any extra specifics we hold that aren't part of the category schema.
      for (const [, key] of byLower) {
        const vals = aspects[key].filter((v) => v && v.trim());
        if (vals.length > 0) canonical[key] = vals;
      }
      if (Object.keys(canonical).length > 0) product.aspects = canonical;

      // eBay rejects a condition that isn't valid for the category (error 25021).
      // Snap the item to the closest grade this category actually accepts — but
      // never override an explicit, already-valid eBay enum the caller supplied.
      if (!specific.condition) {
        const validConditionIds = await EbayAdapter.getValidConditions(fields.categoryId);
        const conditionFix = resolveEbayCategoryCondition(input.condition, validConditionIds);
        if (conditionFix.condition) ebayCondition = conditionFix.condition;
      }
    } else if (Object.keys(aspects).length > 0) {
      product.aspects = aspects;
    }

    const inventoryItem: Record<string, unknown> = {
      availability: { shipToLocationAvailability: { quantity: input.quantity ?? 1 } },
      condition: ebayCondition,
      product,
    };

    if (specific.conditionDescription) {
      inventoryItem.conditionDescription = specific.conditionDescription;
    }

    if (specific.weight || specific.dimensions) {
      // packageType is deliberately NOT sent. eBay rejects the whole
      // <ShippingPackage> (error 25101 / 216305) when the packageType isn't
      // supported by the courier in the resolved fulfillment policy, and it's
      // optional — calculated shipping computes rates from weight + dimensions
      // alone. We keep the seller's chosen packageType stored as metadata only.
      const pkg: Record<string, unknown> = {};
      if (specific.weight) {
        pkg.weight = specific.weight;
      }
      if (specific.dimensions) {
        pkg.dimensions = specific.dimensions;
      }
      inventoryItem.packageWeightAndSize = pkg;
    }

    await this.request(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      body: JSON.stringify(inventoryItem),
    });

    logger.info({ userId: this.userId, sku }, 'eBay inventory item created');

    // Re-publish reuses the existing offer (no duplicate); a first-time listing POSTs a new one.
    const boTerms = EbayAdapter.bestOfferTerms(specific, input.price, input.currency);
    const offerBody = (withBestOffer: boolean): string => JSON.stringify({
      sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      listingDescription: input.description,
      pricingSummary: {
        price: { value: String(input.price), currency: input.currency },
      },
      categoryId: fields.categoryId,
      merchantLocationKey: fields.merchantLocationKey,
      listingPolicies: {
        fulfillmentPolicyId: fields.fulfillmentPolicyId,
        paymentPolicyId: fields.paymentPolicyId,
        returnPolicyId: fields.returnPolicyId,
        ...(withBestOffer ? boTerms : {}),
      },
    });

    // Set when the retry-without fallback fires — the seller opted into Best
    // Offer and the listing went up without it, so the result must say so.
    let bestOfferDowngraded = false;
    const BEST_OFFER_DOWNGRADE_WARNING =
      'Listed without Best Offer auto-accept — eBay rejected it for this listing.';

    const postOffer = async (): Promise<{ offerId: string }> => {
      try {
        return await this.request<{ offerId: string }>('/sell/inventory/v1/offer', {
          method: 'POST',
          body: offerBody(true),
        });
      } catch (err) {
        // Best-Offer category support is not verifiable pre-flight — on a
        // best-offer-specific rejection, retry once without the terms rather
        // than failing the whole listing.
        if (Object.keys(boTerms).length > 0 && EbayAdapter.isBestOfferRejection(err)) {
          logger.warn({ userId: this.userId, sku, error: (err as Error).message, details: err instanceof AppError ? err.details : undefined }, 'eBay rejected bestOfferTerms — retrying offer without Best Offer');
          bestOfferDowngraded = true;
          return await this.request<{ offerId: string }>('/sell/inventory/v1/offer', {
            method: 'POST',
            body: offerBody(false),
          });
        }
        // Stable SKU: a prior attempt (that later failed at publish) may have
        // already created this offer. eBay rejects the duplicate with error 25002;
        // recover by reusing the existing offer instead of failing the publish —
        // and without churning a second offer (an ATO signal).
        if (EbayAdapter.isOfferExistsError(err)) {
          const existing = await this.request<{ offers?: Array<{ offerId: string }> }>(
            `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=EBAY_US`,
            { method: 'GET' },
          );
          const existingOfferId = existing.offers?.[0]?.offerId;
          if (existingOfferId) return { offerId: existingOfferId };
        }
        throw err;
      }
    };

    const offerData: { offerId: string } = input.ebayOfferId
      ? { offerId: input.ebayOfferId }
      : await postOffer();

    // Draft mode: the unpublished offer exists on eBay (offerId + SKU) but we
    // deliberately skip /publish. This is an intentional draft, not a publish
    // failure, so it carries no warning — except a Best Offer downgrade.
    if (input.publishMode === 'draft') {
      logger.info({ userId: this.userId, sku, offerId: offerData.offerId }, 'eBay offer saved as draft (publish skipped)');
      return {
        marketplaceListingId: offerData.offerId,
        ebayOfferId: offerData.offerId,
        ebaySku: sku,
        status: 'draft',
        ...(bestOfferDowngraded ? { warning: BEST_OFFER_DOWNGRADE_WARNING } : {}),
      };
    }

    let listingId: string;
    let status: 'active' | 'draft' | 'pending' = 'draft';

    let marketplaceUrl: string | undefined;
    let warning: string | undefined;

    try {
      const publishResult = await this.request<{ listingId: string }>(
        `/sell/inventory/v1/offer/${offerData.offerId}/publish`,
        { method: 'POST' },
      );
      listingId = publishResult.listingId;
      status = 'active';
      marketplaceUrl = `https://www.ebay.com/itm/${listingId}`;
      logger.info({ userId: this.userId, listingId }, 'eBay listing published');
    } catch (err) {
      listingId = offerData.offerId;
      status = 'draft';
      // request() already parsed eBay's error body into a sanitized message —
      // surface the actual reason (account lock, missing weight, …), not just
      // the generic fallback line.
      warning = `Listing created as draft — publish to eBay failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn({ userId: this.userId, offerId: offerData.offerId, err: (err as Error).message }, 'eBay listing created as draft — publish failed');
    }

    if (bestOfferDowngraded) {
      warning = warning ? `${warning} ${BEST_OFFER_DOWNGRADE_WARNING}` : BEST_OFFER_DOWNGRADE_WARNING;
    }

    return {
      marketplaceListingId: listingId,
      marketplaceUrl,
      status,
      warning,
      ebayOfferId: offerData.offerId,
      ebaySku: sku,
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    if (input.ebaySku) {
      let ebayCondition = resolveEbayCondition(input.condition ?? 'good', input.marketplaceSpecific);
      const specific = input.marketplaceSpecific ?? {};

      // Same per-category guard as publish (eBay error 25021): snap to a grade the
      // category accepts, unless an explicit valid enum was supplied.
      if (specific.categoryId && !specific.condition) {
        const validConditionIds = await EbayAdapter.getValidConditions(specific.categoryId as string);
        const conditionFix = resolveEbayCategoryCondition(input.condition ?? 'good', validConditionIds);
        if (conditionFix.condition) ebayCondition = conditionFix.condition;
      }

      const product: Record<string, unknown> = {};
      if (input.title) product.title = input.title;
      if (input.description) product.description = input.description;
      if (input.photos) product.imageUrls = input.photos.map((p) => p.url);
      if (input.brand) product.brand = input.brand;
      if (input.model) product.mpn = input.model;
      if (specific.upc) product.upc = [specific.upc as string];
      if (specific.epid) product.epid = specific.epid;
      if (specific.aspects) product.aspects = specific.aspects;

      const inventoryItem: Record<string, unknown> = {
        availability: { shipToLocationAvailability: { quantity: input.quantity ?? 1 } },
        condition: ebayCondition,
        product,
      };

      if (specific.conditionDescription) {
        inventoryItem.conditionDescription = specific.conditionDescription;
      }

      if (specific.weight || specific.dimensions) {
        // packageType is deliberately NOT sent — symmetry with createListing.
        // eBay rejects the whole <ShippingPackage> (error 25101 / 216305) when
        // packageType isn't supported by the courier in the resolved fulfillment
        // policy, and it's optional: calculated shipping computes rates from
        // weight + dimensions alone. The seller's packageType stays metadata-only.
        const pkg: Record<string, unknown> = {};
        if (specific.weight) pkg.weight = specific.weight;
        if (specific.dimensions) pkg.dimensions = specific.dimensions;
        inventoryItem.packageWeightAndSize = pkg;
      }

      await this.request(`/sell/inventory/v1/inventory_item/${input.ebaySku}`, {
        method: 'PUT',
        body: JSON.stringify(inventoryItem),
      });

      logger.info({ userId: this.userId, sku: input.ebaySku }, 'eBay inventory item updated');
    }

    const offerId = input.ebayOfferId ?? marketplaceListingId;
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.description) updates.listingDescription = input.description;
    if (input.price) {
      updates.pricingSummary = {
        price: { value: String(input.price), currency: input.currency ?? 'USD' },
      };
    }

    // Best Offer on update: only when the COMPLETE policy set is in hand —
    // eBay's offer PUT replaces listingPolicies wholesale (per updateOffer
    // docs: complex provided fields are replaced, not merged), so a partial
    // block (bestOfferTerms alone) would strip the policy ids off the live offer.
    const updateSpecific = (input.marketplaceSpecific ?? {}) as Record<string, unknown>;
    const updateBoTerms = input.price
      ? EbayAdapter.bestOfferTerms(updateSpecific, input.price, input.currency ?? 'USD')
      : {};
    const hasFullPolicies = Boolean(
      updateSpecific.fulfillmentPolicyId && updateSpecific.paymentPolicyId && updateSpecific.returnPolicyId,
    );
    if (Object.keys(updateBoTerms).length > 0 && hasFullPolicies) {
      updates.listingPolicies = {
        fulfillmentPolicyId: updateSpecific.fulfillmentPolicyId,
        paymentPolicyId: updateSpecific.paymentPolicyId,
        returnPolicyId: updateSpecific.returnPolicyId,
        ...updateBoTerms,
      };
    }

    let updateWarning: string | undefined;
    if (Object.keys(updates).length > 0) {
      try {
        await this.request(`/sell/inventory/v1/offer/${offerId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
      } catch (err) {
        // Same retry-once pattern as createListing, but here the WHOLE
        // listingPolicies block is dropped — bestOfferTerms can't be removed
        // without resending the block, and a partial block would strip ids.
        if (!updates.listingPolicies || !EbayAdapter.isBestOfferRejection(err)) {
          throw err;
        }
        logger.warn({ userId: this.userId, offerId, error: (err as Error).message, details: err instanceof AppError ? err.details : undefined }, 'eBay rejected bestOfferTerms on update — retrying without Best Offer');
        updateWarning = 'Updated without Best Offer auto-accept — eBay rejected it for this listing.';
        delete updates.listingPolicies;
        if (Object.keys(updates).length > 0) {
          await this.request(`/sell/inventory/v1/offer/${offerId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
          });
        }
      }
    }

    logger.info({ userId: this.userId, marketplaceListingId }, 'eBay listing updated');

    return {
      marketplaceListingId,
      marketplaceUrl: `https://www.ebay.com/itm/${marketplaceListingId}`,
      status: 'active',
      ...(updateWarning ? { warning: updateWarning } : {}),
    };
  }

  async bulkPublishOffers(offerIds: string[]): Promise<Array<{ offerId: string; listingId?: string; success: boolean; error?: string }>> {
    const data = await this.request<{
      responses: Array<{
        statusCode: number;
        offerId: string;
        listingId?: string;
        errors?: Array<{ message: string }>;
      }>;
    }>('/sell/inventory/v1/bulk_publish_offer', {
      method: 'POST',
      body: JSON.stringify({ requests: offerIds.map((offerId) => ({ offerId })) }),
    });

    return data.responses.map((r) => ({
      offerId: r.offerId,
      listingId: r.statusCode === 200 ? r.listingId : undefined,
      success: r.statusCode === 200,
      error: r.statusCode !== 200 ? r.errors?.[0]?.message : undefined,
    }));
  }

  async deleteListing(marketplaceListingId: string): Promise<void> {
    await this.request(`/sell/inventory/v1/offer/${marketplaceListingId}`, {
      method: 'DELETE',
    });

    logger.info({ userId: this.userId, marketplaceListingId }, 'eBay listing deleted');
  }

  async getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'> {
    try {
      const data = await this.request<{ status: string }>(`/sell/inventory/v1/offer/${marketplaceListingId}`);

      switch (data.status) {
        case 'PUBLISHED': return 'active';
        case 'ENDED': return 'ended';
        default: return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  async getOrders(since?: Date): Promise<MarketplaceOrderResult[]> {
    const params = new URLSearchParams({ limit: '50' });
    if (since) {
      params.set('filter', `creationdate:[${since.toISOString()}..]`);
    }

    const data = await this.request<{
      orders?: Array<{
        orderId: string;
        buyer: { username: string };
        pricingSummary: {
          total: { value: string; currency: string };
          deliveryCost: { value: string };
        };
        totalFeeBasisAmount?: { value: string };
        lineItems?: Array<{ legacyItemId: string }>;
        fulfillmentStartInstructions?: Array<{
          shippingStep?: {
            shipTo?: {
              fullName: string;
              contactAddress: {
                addressLine1: string;
                addressLine2?: string;
                city: string;
                stateOrProvince: string;
                postalCode: string;
                countryCode: string;
              };
            };
          };
        }>;
      }>;
    }>(`/sell/fulfillment/v1/order?${params}`);

    return (data.orders ?? []).map((order) => {
      const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
      const address = shipTo?.contactAddress;

      return {
        marketplaceOrderId: order.orderId,
        marketplaceListingId: order.lineItems?.[0]?.legacyItemId ?? null,
        buyerUsername: order.buyer.username,
        salePrice: parseFloat(order.pricingSummary.total.value),
        shippingCost: parseFloat(order.pricingSummary.deliveryCost?.value ?? '0'),
        marketplaceFees: parseFloat(order.totalFeeBasisAmount?.value ?? '0'),
        currency: order.pricingSummary.total.currency,
        shippingAddress: {
          name: shipTo?.fullName ?? '',
          street1: address?.addressLine1 ?? '',
          street2: address?.addressLine2,
          city: address?.city ?? '',
          state: address?.stateOrProvince ?? '',
          zip: address?.postalCode ?? '',
          country: address?.countryCode ?? 'US',
        },
      };
    });
  }

  async searchCategories(query: string): Promise<MarketplaceCategoryResult[]> {
    const data = await this.request<{
      categorySuggestions?: Array<{
        category: {
          categoryId: string;
          categoryName: string;
        };
        categoryTreeNodeAncestors?: Array<{ categoryName: string }>;
        categoryTreeNodeLevel: number;
      }>;
    }>(`/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`);

    return (data.categorySuggestions ?? []).map((suggestion) => {
      const ancestors = suggestion.categoryTreeNodeAncestors ?? [];
      const path = [...ancestors.map((a) => a.categoryName).reverse(), suggestion.category.categoryName];

      return {
        id: suggestion.category.categoryId,
        name: suggestion.category.categoryName,
        path,
        isLeaf: true,
      };
    });
  }

  // Account API business-policy creation for one-click eBay seller setup.
  // Cache of policyId → isCalculated for this adapter instance. Adapters are
  // created per request, so this dedupes repeat lookups within a single
  // createListing/publish call, not across requests.
  private readonly calculatedPolicyCache = new Map<string, boolean>();

  /**
   * Return true when the fulfillment policy uses CALCULATED shipping (which
   * hard-requires a package weight + dimensions). Cached per adapter instance.
   * Fail-open: a lookup error returns false so a transient hiccup never blocks
   * a publish.
   */
  async getFulfillmentPolicy(policyId: string): Promise<boolean> {
    const cached = this.calculatedPolicyCache.get(policyId);
    if (cached !== undefined) return cached;
    try {
      const policy = await this.request<{ shippingOptions?: Array<{ costType?: string }> }>(
        `/sell/account/v1/fulfillment_policy/${policyId}`,
      );
      const isCalculated = (policy.shippingOptions ?? []).some((o) => o.costType === 'CALCULATED');
      this.calculatedPolicyCache.set(policyId, isCalculated);
      return isCalculated;
    } catch (err) {
      // Fail-open: a transient lookup failure shouldn't block a publish (a
      // fail-closed default would wrongly block valid flat-rate publishes too).
      // Log the HTTP status so a recurring 403 (missing sell.account scope) or
      // 404 (bad policyId) — which silently skip the gate — is diagnosable.
      const status = err instanceof AppError ? err.statusCode : undefined;
      logger.warn({ userId: this.userId, policyId, status, err: (err as Error).message }, 'fulfillment policy lookup failed — weight gate skipped this publish');
      return false;
    }
  }

  // CALCULATED + USPSParcel: buyer pays the exact computed shipping cost, which
  // needs the item's packageWeightAndSize (captured end-to-end now). The earlier
  // LOGISTICS_INFO_IS_MISSING rejection was NOT a missing rate table — it was a
  // downstream symptom of an invalid service code. A live probe confirmed:
  // USPSGround → NOT_VALID_FOR_SELLING, USPSGroundAdvantage → UNKNOWN_SHIPPING_
  // SERVICE_CODE, but USPSParcel/USPSPriority are accepted for CALCULATED. No
  // freeShipping/shippingCost — calculated computes the rate.
  private fulfillmentPolicyBody(name: string) {
    return {
      name,
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      handlingTime: { value: 1, unit: 'DAY' },
      // eBay's PUT (full replace, used by updateFulfillmentPolicy) requires
      // globalShipping explicitly — without it the migrate PUT fails with 20403
      // "Global shipping field is null". POST defaults it, so including it is safe
      // for both. We don't offer eBay International Shipping by default.
      globalShipping: false,
      shippingOptions: [{
        optionType: 'DOMESTIC',
        costType: 'CALCULATED',
        shippingServices: [{
          sortOrder: 1,
          shippingCarrierCode: 'USPS',
          shippingServiceCode: 'USPSParcel',
        }],
      }],
    };
  }

  // Per-seller writes, so they use this.request() (the seller's OAuth token,
  // which carries the sell.account scope) — not the static app-token reads.
  async createFulfillmentPolicy(name: string): Promise<string> {
    const result = await this.request<{ fulfillmentPolicyId: string }>('/sell/account/v1/fulfillment_policy', {
      method: 'POST',
      body: JSON.stringify(this.fulfillmentPolicyBody(name)),
    });
    logger.info({ userId: this.userId, fulfillmentPolicyId: result.fulfillmentPolicyId }, 'eBay fulfillment policy created');
    return result.fulfillmentPolicyId;
  }

  // Migrate an existing policy (e.g. a legacy FLAT_RATE "Portage Standard
  // Fulfillment") to the canonical CALCULATED shape in place. PUT is a full
  // replace and keeps the same policyId, so live offers referencing it stay valid.
  async updateFulfillmentPolicy(policyId: string, name: string): Promise<string> {
    const result = await this.request<{ fulfillmentPolicyId: string }>(`/sell/account/v1/fulfillment_policy/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify(this.fulfillmentPolicyBody(name)),
    });
    logger.info({ userId: this.userId, fulfillmentPolicyId: policyId }, 'eBay fulfillment policy migrated to calculated');
    return result.fulfillmentPolicyId ?? policyId;
  }

  async createPaymentPolicy(name: string): Promise<string> {
    const result = await this.request<{ paymentPolicyId: string }>('/sell/account/v1/payment_policy', {
      method: 'POST',
      body: JSON.stringify({
        name,
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
        immediatePay: true,
      }),
    });
    logger.info({ userId: this.userId, paymentPolicyId: result.paymentPolicyId }, 'eBay payment policy created');
    return result.paymentPolicyId;
  }

  async createReturnPolicy(name: string): Promise<string> {
    const result = await this.request<{ returnPolicyId: string }>('/sell/account/v1/return_policy', {
      method: 'POST',
      body: JSON.stringify({
        name,
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
        returnsAccepted: true,
        returnPeriod: { value: 30, unit: 'DAY' },
        returnShippingCostPayer: 'BUYER',
        refundMethod: 'MONEY_BACK',
      }),
    });
    logger.info({ userId: this.userId, returnPolicyId: result.returnPolicyId }, 'eBay return policy created');
    return result.returnPolicyId;
  }

  // Inventory API location create (POST, returns 204). The merchantLocationKey
  // in the path is the id — POST is NOT idempotent (it 400s if the key already
  // exists), so the caller (auto-setup, T12) guards with a GET-first check.
  // A warehouse location with a postalCode is what eBay uses as the ship-from
  // for the calculated-shipping fulfillment policy.
  async createInventoryLocation(
    merchantLocationKey: string,
    address: {
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      stateOrProvince?: string;
      postalCode?: string;
      country: string;
    },
    name?: string,
  ): Promise<void> {
    if (!/^[a-zA-Z0-9_-]+$/.test(merchantLocationKey)) {
      throw new AppError(400, 'INVALID_LOCATION_KEY', `merchantLocationKey "${merchantLocationKey}" contains invalid characters — only letters, digits, hyphens and underscores are allowed.`);
    }
    await this.request(`/sell/inventory/v1/location/${merchantLocationKey}`, {
      method: 'POST',
      body: JSON.stringify({
        location: { address },
        name,
        merchantLocationStatus: 'ENABLED',
        locationTypes: ['WAREHOUSE'],
      }),
    });
    logger.info({ userId: this.userId, merchantLocationKey }, 'eBay inventory location created');
  }

  static async searchComps(query: string, category?: string): Promise<CompResult> {
    const fetchListings = async (filters: string[], retry = true): Promise<CompListing[]> => {
      const token = await getEbayProdAppToken();
      const params = new URLSearchParams({
        q: query,
        limit: '25',
      });
      for (const f of filters) {
        params.append('filter', f);
      }
      if (category) {
        params.append('category_ids', category);
      }

      const response = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': EBAY_USER_AGENT,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error({ status: response.status, body, query }, 'eBay Browse API error');
        if ((response.status === 401 || response.status === 403) && retry) {
          invalidateEbayProdAppToken();
          return fetchListings(filters, false);
        }
        throw new Error(`eBay search failed (HTTP ${response.status})`);
      }

      const data = await response.json() as {
        itemSummaries?: Array<{
          title: string;
          price: { value: string; currency: string };
          condition: string;
          image?: { imageUrl: string };
          itemWebUrl: string;
          itemEndDate?: string;
        }>;
      };

      return (data.itemSummaries ?? []).map((item) => ({
        title: item.title,
        price: parseFloat(item.price.value),
        currency: item.price.currency,
        condition: normalizeEbayCondition(item.condition),
        imageUrl: item.image?.imageUrl ?? null,
        listingUrl: item.itemWebUrl,
        soldDate: item.itemEndDate ?? null,
      }));
    };

    const [activeResult, soldResult] = await Promise.allSettled([
      fetchListings(['buyingOptions:{FIXED_PRICE}']),
      fetchListings(['buyingOptions:{FIXED_PRICE}', 'soldItemsOnly:true']),
    ]);

    const active = activeResult.status === 'fulfilled' ? activeResult.value : [];
    const sold = soldResult.status === 'fulfilled' ? soldResult.value : [];

    if (activeResult.status === 'rejected' && soldResult.status === 'rejected') {
      throw activeResult.reason;
    }

    const median = (prices: number[]): number | null => {
      if (prices.length === 0) return null;
      const sorted = [...prices].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const avg = (prices: number[]): number | null => {
      if (prices.length === 0) return null;
      return Math.round(prices.reduce((s, p) => s + p, 0) / prices.length * 100) / 100;
    };

    const soldPrices = sold.map((s) => s.price);
    const activePrices = active.map((a) => a.price);

    const partial = activeResult.status === 'rejected' || soldResult.status === 'rejected';

    // Market-shape bands over the RAW sold pool (no condition filter) — context
    // for the comps UI. Listing-price bands come from the prepare-listing engine.
    const soldBands = computePriceBands(soldPrices);
    const totalComps = sold.length + active.length;

    return {
      sold,
      active,
      stats: {
        soldMedian: median(soldPrices),
        soldAvg: avg(soldPrices),
        activeMedian: median(activePrices),
        activeAvg: avg(activePrices),
        sampleSize: totalComps,
        p25: soldBands?.p25 ?? null,
        p50: soldBands?.p50 ?? null,
        p75: soldBands?.p75 ?? null,
        sellThrough: totalComps > 0 ? Math.round((sold.length / totalComps) * 100) / 100 : null,
      },
      ...(partial && { partial: true }),
    };
  }

  static async getCategorySuggestion(query: string): Promise<{ categoryId: string; categoryName: string } | null> {
    const token = await getEbayProdAppToken();

    const response = await fetch(
      `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': EBAY_USER_AGENT,
          'Accept': 'application/json',
        },
      },
    );

    if (!response.ok) {
      logger.error({ status: response.status, query }, 'eBay category suggestion failed');
      return null;
    }

    const data = await response.json() as {
      categorySuggestions?: Array<{
        category: { categoryId: string; categoryName: string };
      }>;
    };

    const first = data.categorySuggestions?.[0];
    if (!first) return null;

    return {
      categoryId: first.category.categoryId,
      categoryName: first.category.categoryName,
    };
  }

  static async getRequiredAspects(categoryId: string): Promise<Record<string, { required: boolean; values: string[] | null; cardinality: 'SINGLE' | 'MULTI' }>> {
    const cached = requiredAspectsCache.get(categoryId);
    if (cached && Date.now() - cached.cachedAt < REQUIRED_ASPECTS_TTL) return cached.value;

    const token = await getEbayProdAppToken();

    const response = await fetch(
      `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': EBAY_USER_AGENT,
          'Accept': 'application/json',
        },
      },
    );

    if (!response.ok) {
      logger.error({ status: response.status, categoryId }, 'eBay aspects fetch failed');
      return {};
    }

    const data = await response.json() as {
      aspects?: Array<{
        localizedAspectName: string;
        aspectConstraint?: { aspectRequired?: boolean; itemToAspectCardinality?: string };
        aspectValues?: Array<{ localizedValue: string }>;
      }>;
    };

    const result: Record<string, { required: boolean; values: string[] | null; cardinality: 'SINGLE' | 'MULTI' }> = {};
    for (const aspect of data.aspects ?? []) {
      result[aspect.localizedAspectName] = {
        required: aspect.aspectConstraint?.aspectRequired ?? false,
        values: aspect.aspectValues?.map(v => v.localizedValue) ?? null,
        cardinality: aspect.aspectConstraint?.itemToAspectCardinality === 'MULTI' ? 'MULTI' : 'SINGLE',
      };
    }

    requiredAspectsCache.set(categoryId, { value: result, cachedAt: Date.now() });
    return result;
  }

  // Per-category valid item conditions from the Metadata API. Mirrors
  // getRequiredAspects: prod app token, graceful [] on any failure so a
  // transient Metadata hiccup never blocks listing preparation.
  static async getValidConditions(categoryId: string): Promise<string[]> {
    const cached = validConditionsCache.get(categoryId);
    if (cached && Date.now() - cached.cachedAt < VALID_CONDITIONS_TTL) return cached.value;

    const token = await getEbayProdAppToken();

    const filter = encodeURIComponent(`categoryIds:{${categoryId}}`);
    const response = await fetch(
      `https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=${filter}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': EBAY_USER_AGENT,
          'Accept': 'application/json',
        },
      },
    );

    if (!response.ok) {
      logger.error({ status: response.status, categoryId }, 'eBay condition policies fetch failed');
      return [];
    }

    const data = await response.json() as {
      itemConditionPolicies?: Array<{
        itemConditions?: Array<{ conditionId: string }>;
      }>;
    };

    const conditions = data.itemConditionPolicies?.[0]?.itemConditions ?? [];
    const result = conditions.map(c => c.conditionId);
    validConditionsCache.set(categoryId, { value: result, cachedAt: Date.now() });
    return result;
  }
}
