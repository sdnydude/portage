import { createLogger } from '../lib/logger.js';
import { computePriceBands } from '../lib/pricing.js';
import { env } from '../lib/env.js';
import { AppError } from '../middleware/error.js';
import { getEbayAccessToken, getEbayProdAppToken, invalidateEbayProdAppToken } from './token-manager.js';
import { callTradingApi, EbayTradingError } from './ebay-trading-client.js';

// Stable eBay Trading codes for price-vs-threshold conflicts (BO-2):
// 22003 = auto-decline amount >= Buy It Now price, 23004 = auto-accept >= price.
const BEST_OFFER_THRESHOLD_CODES = new Set([22003, 23004]);

// P3 (25afd214): every BEST_OFFER_CONFLICT throw carries the same structured
// payload the route pre-flight produces, so the client's guided fix can
// re-seed the offer fields. The adapter only knows what THIS call submitted —
// values absent here mean "stored on the live listing"; the route enriches
// from GetItem at conflict time and owns the `healed` flag.
function boConflictDetails(input: {
  bestOfferEnabled?: boolean;
  bestOfferAutoAcceptPrice?: number;
  minimumBestOfferPrice?: number;
}): BestOfferConflictDetails[] {
  return [{
    bestOfferEnabled: input.bestOfferEnabled ?? null,
    bestOfferAutoAcceptPrice: input.bestOfferAutoAcceptPrice ?? null,
    minimumBestOfferPrice: input.minimumBestOfferPrice ?? null,
    healed: false,
  }];
}
import { buildAddFixedPriceItemXml, buildEndFixedPriceItemXml, buildGetItemXml,
  buildReviseFixedPriceItemXml, buildReviseInventoryStatusXml, parseAddItemResponse, parseGetItemStatus, parseGetItemVerification, splitOunces, type TradingListingInput } from './ebay-trading-builders.js';
import { EBAY_USER_AGENT } from './ebay-constants.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
  CompListing,
  CompResult,
  EbayPreparedFields,
  EbayListingShipping,
  BestOfferConflictDetails,
} from '@portage/shared';

const logger = createLogger('ebay-adapter');

// TTL caches for per-category taxonomy lookups (mirrors the Etsy shopId/taxonomy
// cache pattern). Keyed by categoryId; only successful (HTTP ok) responses are
// cached so a transient eBay error never poisons the cache for the TTL window.
const validConditionsCache = new Map<string, { value: string[]; cachedAt: number }>();
const VALID_CONDITIONS_TTL = 60 * 60 * 1000; // 1h
const requiredAspectsCache = new Map<string, { value: Record<string, { required: boolean; values: string[] | null; cardinality: 'SINGLE' | 'MULTI' }>; cachedAt: number }>();
const REQUIRED_ASPECTS_TTL = 24 * 60 * 60 * 1000; // 24h
// BO-M: per-category Best Offer support (Metadata API getNegotiatedPricePolicies). Category
// features change rarely — long TTL; null (unknown) is never cached.
const bestOfferSupportCache = new Map<string, { value: boolean; cachedAt: number }>();
const BEST_OFFER_SUPPORT_TTL = 24 * 60 * 60 * 1000; // 24h

// Test seam: module-level caches survive across vitest tests in a file.
export function clearEbayTaxonomyCaches(): void {
  validConditionsCache.clear();
  requiredAspectsCache.clear();
  bestOfferSupportCache.clear();
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

/** Stored Inventory-API package enum (items.ebayPackageType) → Trading
 * ShippingPackageCodeType. Values live-verified via GeteBayDetails
 * DetailName=ShippingPackageDetails (2026-08-01): Letter, LargeEnvelope,
 * PackageThickEnvelope ("Package"), USPSLargePack ("LargePackage").
 * LARGE_PACKAGE is a legacy stored spelling of USPS_LARGE_PACKAGE. */
const TRADING_SHIPPING_PACKAGE: Record<string, string> = {
  MAILING_BOX: 'PackageThickEnvelope',
  PACKAGE_THICK_ENVELOPE: 'PackageThickEnvelope',
  LARGE_ENVELOPE: 'LargeEnvelope',
  LETTER: 'Letter',
  USPS_LARGE_PACKAGE: 'USPSLargePack',
  LARGE_PACKAGE: 'USPSLargePack',
};

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

const EBAY_ENUM_TO_CONDITION_ID: Record<string, string> = Object.fromEntries(
  Object.entries(EBAY_CONDITION_ID_TO_ENUM).map(([id, en]) => [en, id]),
);

/**
 * Numeric eBay ConditionID for the Trading API (N2 — Trading uses numeric ids, not
 * the Inventory API's enum strings). Precedence mirrors resolveEbayCondition: an
 * explicit numeric conditionId (per-category validated) wins, then a supplied enum
 * is reverse-mapped, then the Portage grade's first preferred id, falling back to
 * 3000 (generic Used) for an unknown grade.
 */
export function resolveEbayConditionId(portageCondition: string, specific?: Record<string, unknown>): string {
  const explicitId = specific?.conditionId;
  if (typeof explicitId === 'string' && explicitId.length > 0) return explicitId;
  const enumOverride = specific?.condition;
  if (typeof enumOverride === 'string' && EBAY_ENUM_TO_CONDITION_ID[enumOverride]) {
    return EBAY_ENUM_TO_CONDITION_ID[enumOverride];
  }
  return CONDITION_PREFERENCE_CHAINS[portageCondition]?.[0] ?? '3000';
}

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

/**
 * Shape returned by the F-GATE verification read — the live eBay state for one SKU:
 * the inventory_item's item specifics (aspects, incl. MPN) plus the offer's identity
 * and status. Fields are optional because a never-published / orphaned offer or a
 * missing inventory_item can each be absent independently.
 */
export interface EbayItemVerification {
  /** The listing's SKU as reported by eBay, or null when GetItem returns no SKU. */
  sku: string | null;
  found: boolean;
  aspects: Record<string, string[]>;
  mpn: string | null;
  brand: string | null;
  status: string | null;
  /** The Trading ItemID (eBay listing id) echoed back by GetItem, or null. */
  listingId: string | null;
  /** The live StartPrice on eBay, or null. */
  price: string | null;
  /** Live Best Offer state (BO-3) — feeds the conflict-time threshold heal. */
  bestOfferEnabled: boolean | null;
  bestOfferAutoAcceptPrice: number | null;
  minimumBestOfferPrice: number | null;
}

/**
 * Minimal live-listing snapshot used to reconstruct a local item+listing when an
 * order references a listing Portage never stored. `found:false` means GetItem
 * failed (ended/purged/unknown ItemID) — caller falls back to the order payload.
 */
export interface EbayItemDetail {
  found: boolean;
  title: string | null;
  photos: string[];
  price: number | null;
  brand: string | null;
  aspects: Record<string, string[]>;
}

/**
 * Analytics API traffic metrics for one listing over a date window. Any metric can
 * be null when eBay has no data for it in the window.
 */
export interface EbayTrafficReport {
  listingId: string;
  impressions: number | null;
  clickThroughRate: number | null;
  views: number | null;
  transactions: number | null;
  salesConversionRate: number | null;
  range: { from: string; to: string };
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
  // Mismatch guard, advisory only (no user present at this call site): a live
  // resolution implausible for the item's persisted vision category is logged,
  // never substituted or blocked.
  const visionCategory = (item.marketplaceData as { scan?: { visionCategory?: string } } | null | undefined)
    ?.scan?.visionCategory;
  if (
    suggestion?.rootCategoryId
    && visionCategory
    && !EbayAdapter.isPlausibleRoot(visionCategory, suggestion.rootCategoryId)
  ) {
    logger.warn(
      {
        title: item.title,
        visionCategory,
        categoryId: suggestion.categoryId,
        categoryName: suggestion.categoryName,
        rootCategoryId: suggestion.rootCategoryId,
      },
      'eBay category suggestion implausible for the scanned kind — publishing anyway (advisory guard)',
    );
  }
  return {
    categoryId: suggestion?.categoryId ?? null,
    categoryName: suggestion?.categoryName ?? null,
    newlyResolved: !!suggestion?.categoryId,
  };
}

/**
 * Normalize a marketplaceSpecific.aspects bag to eBay's array-of-strings shape
 * (the prepare-listing AI sometimes emits a scalar per aspect, which crashed the
 * publish path), and backfill Brand/Model/MPN from the product identity. Shared by
 * createListing and updateListing so both send identical, valid specifics. The MPN
 * passed here is product.mpn (real part number, or the "Does Not Apply" sentinel),
 * mirrored into the MPN item-specific so the eBay listing actually shows it.
 */
function normalizeAspects(
  rawAspects: Record<string, unknown> | undefined,
  identity: { brand?: string | null; model?: string | null; mpn?: string },
): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(rawAspects ?? {})) {
    const arr = (Array.isArray(v) ? v : [v])
      .map((x) => (typeof x === 'number' || typeof x === 'boolean' ? String(x) : x))
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    if (arr.length > 0) {
      aspects[k] = arr;
    } else {
      // Dropping silently would resurface as a misleading "missing aspect" error
      // at the publish gate — make the discard observable.
      logger.warn({ aspect: k }, 'Discarded non-string aspect value from marketplaceSpecific.aspects');
    }
  }
  if (identity.brand && !aspects.Brand) aspects.Brand = [identity.brand];
  if (identity.model && !aspects.Model) aspects.Model = [identity.model];
  if (identity.mpn && !aspects.MPN) aspects.MPN = [identity.mpn];
  return aspects;
}

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
    // Narrowed backstop (BO-M): the GetCategoryFeatures pre-flight is the
    // primary signal for category support; this matches only eBay's known
    // category-unsupported sentence — never a coincidental word hit, and
    // threshold conflicts are already handled by stable codes upstream.
    return err instanceof Error && /best offer is not (supported|available|allowed)/i.test(err.message);
  }

  /**
   * Build the Trading item payload shared by AddFixedPriceItem (publish) and
   * ReviseFixedPriceItem (content edit). Enforces the publish guards: valid leaf
   * category, ship-from origin ZIP + package weight/dims (inline Calculated shipping),
   * required-aspect gate, and per-category ConditionID snap. `sku` is passed through to
   * the item body; pass undefined on a revise with no SKU so eBay keeps the existing one.
   */
  private async buildTradingInput(input: MarketplaceListingInput, sku: string | undefined): Promise<TradingListingInput> {
    const specific = input.marketplaceSpecific ?? {};

    // A valid leaf category is required ('99' is eBay's unset placeholder).
    const categoryId = specific.categoryId as string | undefined;
    if (!categoryId || categoryId === '99') {
      throw new AppError(400, 'EBAY_CATEGORY_REQUIRED', 'A valid eBay leaf category is required to list this item.');
    }

    // Inline Calculated shipping (Decision 5) needs the seller ship-from origin ZIP
    // plus package weight + dimensions — eBay rejects a Calculated listing without
    // them (errors 25020/21915). These replace the old four-policy setup gate: with
    // the account opted OUT of Business Policies there are no policy IDs to require.
    const originPostalCode = specific.originPostalCode as string | undefined;
    if (!originPostalCode) {
      throw new AppError(422, 'EBAY_SHIP_FROM_REQUIRED', 'Add a ship-from ZIP to your seller profile — eBay needs it for calculated shipping.');
    }
    const rawWeight = specific.weight as { value?: unknown } | undefined;
    const weightOk = typeof rawWeight?.value === 'number' && rawWeight.value > 0;
    const dims = specific.dimensions as { length?: number; width?: number; height?: number } | undefined;
    const dimsOk = !!dims && (dims.length ?? 0) > 0 && (dims.width ?? 0) > 0 && (dims.height ?? 0) > 0;
    // Weight/dims are a CALCULATED-shipping requirement (errors 25020/21915).
    // Flat/free (per-listing ebayShipping) publish without them — the builder
    // floors weight to 1oz so any known dimensions still carry through.
    const shippingMethod = (specific.ebayShipping as EbayListingShipping | undefined)?.method ?? 'calculated';
    // Symmetric with the builder: anything that is not explicitly flat/free
    // serializes as Calculated XML, so it needs weight/dims — an unknown
    // method value must not slip past the gate (schema is an open record).
    if ((!weightOk || !dimsOk) && shippingMethod !== 'flat' && shippingMethod !== 'free') {
      throw new EbayWeightRequiredError();
    }
    // Flat without a positive buyer cost would publish a $0.00 "Flat" listing
    // indistinguishable from free shipping — fail loud instead.
    if (shippingMethod === 'flat') {
      const flatCost = (specific.ebayShipping as EbayListingShipping | undefined)?.flatCost;
      if (!(typeof flatCost === 'number' && flatCost > 0)) {
        throw new AppError(400, 'EBAY_FLAT_COST_REQUIRED', 'Flat-rate shipping needs a buyer cost above $0 — enter the rate or switch to free shipping.');
      }
    }

    // MPN mirrors into aspects; a branded item with no real part number gets eBay's
    // "Does Not Apply" sentinel so the BrandMPN rule (25002) doesn't reject publish.
    let mpn = input.mpn ?? undefined;
    if (input.brand && !mpn) mpn = 'Does Not Apply';
    const aspects = normalizeAspects(specific.aspects as Record<string, unknown> | undefined, {
      brand: input.brand,
      model: input.model,
      mpn,
    });

    // Numeric ConditionID (N2); refined to a category-valid grade below.
    let conditionId = resolveEbayConditionId(input.condition, specific);

    // Publish gate: required category aspects must be present (before any eBay write),
    // and each value is canonicalized under eBay's exact aspect name (SINGLE-cardinality
    // collapsed to one value). Mirrors the prior Inventory gate.
    const required = await EbayAdapter.getRequiredAspects(categoryId);
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
    for (const [, key] of byLower) {
      const vals = aspects[key].filter((v) => v && v.trim());
      if (vals.length > 0) canonical[key] = vals;
    }

    // Snap condition to the closest grade the category accepts (error 25021), unless
    // the caller supplied an explicit, already-valid condition/conditionId.
    if (!specific.condition && !specific.conditionId) {
      const validConditionIds = await EbayAdapter.getValidConditions(categoryId);
      const selected = selectValidEbayCondition(input.condition, validConditionIds);
      if (selected) conditionId = selected.conditionId;
    }

    // Flat/free may have no stored weight/dims (gate skipped above) — zeros here;
    // the builder floors weight and the dimension tags are omitted when unknown.
    const { weightMajor, weightMinor } = splitOunces(weightOk ? (rawWeight!.value as number) : 0);
    const ebayShipping = specific.ebayShipping as EbayListingShipping | undefined;
    return {
      title: input.title,
      description: input.description,
      categoryId,
      price: input.price,
      currency: input.currency,
      quantity: input.quantity ?? 1,
      conditionId,
      // Prepared (AI, user-reviewed) conditionDescription wins; the item's raw
      // conditionNotes fill the gap on publish paths that skipped prepare —
      // without this fallback those paths list with a blank condition note.
      // Trading caps ConditionDescription at 1000 chars.
      conditionDescription: (specific.conditionDescription as string | undefined)
        || input.conditionNotes?.trim().slice(0, 1000)
        || undefined,
      sku,
      // Partial updates (e.g. price + Best Offer fields) can reach the full
      // revise with no photos — omitted PictureDetails keeps eBay's pictures.
      pictureUrls: (input.photos ?? []).map((p) => p.url),
      aspects: canonical,
      shipping: {
        originPostalCode,
        weightMajor,
        weightMinor,
        dimensions: dimsOk
          ? { length: dims!.length!, width: dims!.width!, height: dims!.height! }
          : { length: 0, width: 0, height: 0 },
        // mergeItemShipping puts the item's stored Inventory-API package enum
        // under packageType; Trading takes ShippingPackageCodeType, so translate
        // (raw pass-through = live error 37, 2026-08-01). Unknown values are
        // dropped — the builder default (PackageThickEnvelope) applies.
        ...(typeof specific.packageType === 'string' && TRADING_SHIPPING_PACKAGE[specific.packageType]
          ? { shippingPackage: TRADING_SHIPPING_PACKAGE[specific.packageType] }
          : {}),
        // Per-listing shipping choice (publish sheet) — absent key = legacy calculated.
        ...(ebayShipping?.method ? { method: ebayShipping.method } : {}),
        ...(typeof ebayShipping?.flatCost === 'number' ? { flatCost: ebayShipping.flatCost } : {}),
        ...(ebayShipping?.service ? { service: ebayShipping.service } : {}),
        ...(ebayShipping?.localPickup ? { pickupOffered: true } : {}),
      },
      ...(typeof ebayShipping?.handlingDays === 'number' ? { dispatchTimeMax: ebayShipping.handlingDays } : {}),
      bestOfferAutoAcceptPrice: (specific as Partial<EbayPreparedFields>).bestOfferAutoAcceptPrice,
      // Per-listing "accept offers" toggle + auto-decline floor from the
      // publish sheet (ride marketplaceSpecific; not part of prepared fields).
      bestOfferEnabled: typeof specific.bestOfferEnabled === 'boolean' ? specific.bestOfferEnabled : undefined,
      minimumBestOfferPrice: typeof specific.minimumBestOfferPrice === 'number' ? specific.minimumBestOfferPrice : undefined,
      // Explicit disable (BO-4): toggle-off is the ONLY path that clears the
      // stored thresholds on the live listing — seller intent, never auto.
      // MUST spread LAST: object literals apply later keys last, so the
      // threshold mappings above would otherwise resurrect the stored values
      // (audit finding #3, 2026-08-03).
      ...(specific.bestOfferEnabled === false ? {
        bestOfferAutoAcceptPrice: undefined,
        minimumBestOfferPrice: undefined,
        deleteBestOfferAutoAcceptPrice: true,
        deleteMinimumBestOfferPrice: true,
      } : {}),
    };
  }

  /**
   * Promoted Listings Standard (cost-per-sale): find-or-create the seller's
   * "Portage Promoted Listings" CPS campaign, then attach the live listing as
   * an ad at the given rate (percent of sale price, e.g. 5 → "5.0").
   * sell.marketing is already in the OAuth consent scopes.
   */
  async promoteListing(marketplaceListingId: string, adRatePercent: number): Promise<void> {
    if (!(adRatePercent >= 1 && adRatePercent <= 100)) {
      throw new AppError(400, 'EBAY_AD_RATE_INVALID', 'Ad rate must be between 1% and 100% of the sale price.');
    }
    const token = await getEbayAccessToken(this.userId);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const CAMPAIGN_NAME = 'Portage Promoted Listings';

    const listRes = await fetch(
      'https://api.ebay.com/sell/marketing/v1/ad_campaign?campaign_status=RUNNING&limit=100',
      { headers },
    );
    if (!listRes.ok) {
      throw new AppError(502, 'EBAY_ADS_UNAVAILABLE', `eBay Marketing API rejected the campaign lookup (${listRes.status}).`);
    }
    const listBody = await listRes.json() as { campaigns?: Array<{ campaignId: string; campaignName: string }> };
    let campaignId = listBody.campaigns?.find((c) => c.campaignName === CAMPAIGN_NAME)?.campaignId;

    if (!campaignId) {
      const createRes = await fetch('https://api.ebay.com/sell/marketing/v1/ad_campaign', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          campaignName: CAMPAIGN_NAME,
          marketplaceId: 'EBAY_US',
          fundingStrategy: { fundingModel: 'COST_PER_SALE' },
          startDate: new Date().toISOString(),
        }),
      });
      if (!createRes.ok) {
        throw new AppError(502, 'EBAY_ADS_UNAVAILABLE', `eBay Marketing API rejected campaign creation (${createRes.status}).`);
      }
      // createCampaign returns the new id in the Location header.
      campaignId = createRes.headers.get('Location')?.split('/').pop();
      if (!campaignId) {
        throw new AppError(502, 'EBAY_ADS_UNAVAILABLE', 'eBay created the ad campaign but returned no campaign id.');
      }
    }

    const adRes = await fetch(`https://api.ebay.com/sell/marketing/v1/ad_campaign/${campaignId}/ad`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        listingId: marketplaceListingId,
        bidPercentage: adRatePercent.toFixed(1),
      }),
    });
    // 409 = the listing already has an ad in this campaign — treat as success
    // (re-publishing the same item must not fail the promote step).
    if (!adRes.ok && adRes.status !== 409) {
      const body = await adRes.text();
      logger.warn({ userId: this.userId, marketplaceListingId, status: adRes.status, body }, 'eBay ad creation rejected');
      throw new AppError(502, 'EBAY_ADS_UNAVAILABLE', `eBay rejected the ad for this listing (${adRes.status}).`);
    }
    logger.info({ userId: this.userId, marketplaceListingId, campaignId, adRatePercent }, 'eBay Promoted Listing ad created');
  }

  /**
   * BO-M: does this category allow Best Offer? Deterministic pre-flight via
   * Metadata API getNegotiatedPricePolicies. (GetCategoryFeatures was
   * decommissioned 2026-05-04 — HTTP 410 on every call, observed live
   * 2026-08-04, which left this pre-flight permanently failed-open.)
   * Returns null when eBay doesn't answer OR the category has no policy row
   * — callers FAIL OPEN (send as configured); unknown must never drop
   * seller config.
   */
  private async isCategoryBestOfferSupported(categoryId: string): Promise<boolean | null> {
    const cached = bestOfferSupportCache.get(categoryId);
    if (cached && Date.now() - cached.cachedAt < BEST_OFFER_SUPPORT_TTL) return cached.value;
    try {
      // Application token, NOT the user token: this method requires the
      // client-credentials base api_scope, which the user-consent scope list
      // does not carry — a user token 401s here forever, silently killing
      // the pre-flight (advisor review 2026-08-04, verified against the
      // method reference + eBay's published OAS). PROD app token + prod URL,
      // mirroring getValidConditions' get_item_condition_policies call: the
      // base EBAY_CLIENT_ID creds fail the prod token endpoint
      // (invalid_client — live-probed 2026-08-04).
      const token = await getEbayProdAppToken();
      const filter = encodeURIComponent(`categoryIds:{${categoryId}}`);
      const res = await fetch(`https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_negotiated_price_policies?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Encoding': 'gzip' },
      });
      if (!res.ok) {
        logger.warn({ categoryId, status: res.status }, 'getNegotiatedPricePolicies Best Offer pre-flight failed — proceeding as configured');
        return null;
      }
      const data = await res.json() as { negotiatedPricePolicies?: Array<{ categoryId?: string | number }> };
      if (!Array.isArray(data.negotiatedPricePolicies) || data.negotiatedPricePolicies.length === 0) {
        // Empty/absent container = shape drift or unfiltered miss — unknown,
        // never "unsupported"; a wrong false drops seller config at publish.
        return null;
      }
      // Migration-guide semantics: "If a category is returned in this
      // container, it supports Best Offer." Row PRESENCE is the signal — the
      // per-row automation booleans (auto-accept/decline/counter) describe
      // sub-features and must NOT gate support. A queried leaf category
      // absent from a parsed, non-empty response does not support it.
      const supported = data.negotiatedPricePolicies.some((pol) => String(pol.categoryId) === categoryId);
      bestOfferSupportCache.set(categoryId, { value: supported, cachedAt: Date.now() });
      return supported;
    } catch (err) {
      logger.warn({ categoryId, error: (err as Error).message }, 'getNegotiatedPricePolicies Best Offer pre-flight failed — proceeding as configured');
      return null;
    }
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    const sku = input.ebaySku ?? `portage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const tradingInput = await this.buildTradingInput(input, sku);

    const token = await getEbayAccessToken(this.userId);

    // BO-M: category Best Offer support IS verifiable pre-flight —
    // Metadata API getNegotiatedPricePolicies (row presence = supported), TTL-cached. false →
    // deterministic warn-downgrade (operator decision: warn at create only);
    // true/unknown → send as configured; the prose fallback below is a
    // narrow backstop, never the primary signal.
    let bestOfferDowngraded = false;
    const BEST_OFFER_DOWNGRADE_WARNING = 'Listed without Best Offer — eBay does not allow it in this category.';
    const wantsBestOffer = !!(tradingInput.bestOfferAutoAcceptPrice || tradingInput.bestOfferEnabled);
    if (wantsBestOffer && await this.isCategoryBestOfferSupported(tradingInput.categoryId) === false) {
      bestOfferDowngraded = true;
    }
    const callAdd = (withBestOffer: boolean): Promise<Record<string, unknown>> =>
      callTradingApi(
        'AddFixedPriceItem',
        buildAddFixedPriceItemXml(
          withBestOffer
            ? tradingInput
            : { ...tradingInput, bestOfferAutoAcceptPrice: undefined, bestOfferEnabled: undefined, minimumBestOfferPrice: undefined },
          token,
        ),
        token,
      );

    let parsed: Record<string, unknown>;
    try {
      parsed = await callAdd(!bestOfferDowngraded);
    } catch (err) {
      // BO-2: a threshold conflict at publish means the seller's numbers are
      // wrong for this price — surface them; silently dropping the config
      // (the old behavior) is forbidden. Only the category-unsupported case
      // (prose match, no stable eBay id) keeps the warn-downgrade at create —
      // operator decision 2026-08-03.
      if (err instanceof EbayTradingError && err.errorCodes.some((c) => BEST_OFFER_THRESHOLD_CODES.has(c))) {
        throw new AppError(422, 'BEST_OFFER_CONFLICT',
          `The Best Offer settings conflict with the price $${tradingInput.price} — both thresholds must be below the price. eBay said: ${(err as Error).message}`,
          boConflictDetails(tradingInput));
      }
      if (wantsBestOffer && EbayAdapter.isBestOfferRejection(err)) {
        logger.warn({ userId: this.userId, sku, error: (err as Error).message }, 'eBay rejected Best Offer — retrying AddFixedPriceItem without it');
        bestOfferDowngraded = true;
        parsed = await callAdd(false);
      } else {
        throw err;
      }
    }

    // Warning/PartialFailure still carries an ItemID (M7) — callTradingApi only
    // throws on Failure, so a returned parse means the listing exists.
    const itemId = parseAddItemResponse(parsed);
    if (!itemId) {
      throw new AppError(502, 'EBAY_PUBLISH_FAILED', 'eBay accepted the request but returned no ItemID.');
    }
    logger.info({ userId: this.userId, itemId, sku }, 'eBay listing published via AddFixedPriceItem');

    return {
      marketplaceListingId: itemId,
      marketplaceUrl: `https://www.ebay.com/itm/${itemId}`,
      status: 'active',
      ebaySku: sku,
      ...(bestOfferDowngraded ? { warning: BEST_OFFER_DOWNGRADE_WARNING } : {}),
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    const token = await getEbayAccessToken(this.userId);
    const marketplaceUrl = `https://www.ebay.com/itm/${marketplaceListingId}`;
    const specific = (input.marketplaceSpecific ?? {}) as Record<string, unknown>;

    // A content edit (anything that changes the item body) goes through
    // ReviseFixedPriceItem with the full item payload. A price/quantity-only edit
    // takes the ReviseInventoryStatus fast path — no item rebuild, no aspect gate.
    const hasContentChange = Boolean(
      input.title || input.description || input.photos || input.brand || input.model || input.mpn ||
      input.condition || input.features ||
      specific.aspects || specific.weight || specific.dimensions || specific.categoryId ||
      specific.conditionId || specific.condition || specific.conditionDescription ||
      // Best Offer fields live in the full item body — the fast path would
      // silently drop them (CodeRabbit, BO-6 audit defense-in-depth).
      specific.bestOfferEnabled !== undefined || specific.bestOfferAutoAcceptPrice !== undefined ||
      specific.minimumBestOfferPrice !== undefined,
    );

    if (!hasContentChange && (input.price !== undefined || input.quantity !== undefined)) {
      try {
        await callTradingApi(
          'ReviseInventoryStatus',
          buildReviseInventoryStatusXml(
            marketplaceListingId,
            { price: input.price, quantity: input.quantity, currency: input.currency ?? 'USD' },
            token,
          ),
          token,
        );
      } catch (err) {
        // eBay validates a price change against thresholds STORED on the live
        // listing even here — same typed contract as the full revise
        // (CodeRabbit, BO-6). Never a retry, never a deletion.
        if (err instanceof EbayTradingError && err.errorCodes.some((c) => BEST_OFFER_THRESHOLD_CODES.has(c))) {
          // Unreachable from current callers (listings.ts + marketplace-sync
          // always send title → full revise); kept typed so a future price-only
          // caller still gets the structured payload. Thresholds live on eBay,
          // not in this input — all null until the route's GetItem enrichment.
          throw new AppError(422, 'BEST_OFFER_CONFLICT',
            `The price $${input.price} is at or below this listing's Best Offer settings on eBay — adjust the offer thresholds together with the price. eBay said: ${(err as Error).message}`,
            boConflictDetails(input.marketplaceSpecific ?? {}));
        }
        throw err;
      }
      logger.info({ userId: this.userId, itemId: marketplaceListingId }, 'eBay price/qty revised via ReviseInventoryStatus');
      return { marketplaceListingId, marketplaceUrl, status: 'active' };
    }

    // Full content revise: rebuild the item body with the same guards as publish. The
    // SKU is only re-sent when the caller supplies one, so a revise never rewrites it.
    const tradingInput = await this.buildTradingInput(input as MarketplaceListingInput, input.ebaySku);

    // Zero-photo item: eBay's Revise treats an omitted PictureDetails as
    // "keep the existing pictures". Refusing outright would starve every
    // other field (price, title) of sync for such items — proceed, keep
    // eBay's pictures, and surface the divergence as a warning instead.
    const photosEmpty = tradingInput.pictureUrls.length === 0;
    const EMPTY_PHOTOS_WARNING = 'Item has no photos — the eBay listing keeps its existing pictures until you add one.';

    // BO-2: updates never downgrade-retry. The seller's Best Offer
    // configuration is authoritative — any rejection surfaces as a typed
    // 422 the seller resolves; nothing is deleted or stripped to force the
    // edit through. (createListing keeps its warn-downgrade for the
    // category-unsupported case at first publish only — operator decision
    // 2026-08-03.)
    const wantsBestOffer = !!(tradingInput.bestOfferAutoAcceptPrice || tradingInput.bestOfferEnabled);
    try {
      await callTradingApi(
        'ReviseFixedPriceItem',
        buildReviseFixedPriceItemXml(
          marketplaceListingId,
          { ...tradingInput, ...(photosEmpty ? { allowEmptyPictures: true } : {}) },
          token,
        ),
        token,
      );
    } catch (err) {
      // Threshold conflicts: stable codes 22003 (auto-decline) / 23004
      // (auto-accept), both observed live 2026-08-03. These can fire from
      // thresholds STORED on the live listing even when this revise sent
      // none — surface the numbers, never delete-and-retry.
      if (err instanceof EbayTradingError && err.errorCodes.some((c) => BEST_OFFER_THRESHOLD_CODES.has(c))) {
        const parts = [
          ...(tradingInput.bestOfferAutoAcceptPrice !== undefined ? [`auto-accept $${tradingInput.bestOfferAutoAcceptPrice}`] : []),
          ...(tradingInput.minimumBestOfferPrice !== undefined ? [`minimum offer $${tradingInput.minimumBestOfferPrice}`] : []),
        ];
        const configured = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        throw new AppError(422, 'BEST_OFFER_CONFLICT',
          `The price $${tradingInput.price} is at or below this listing's Best Offer settings${configured} — adjust the offer thresholds together with the price. eBay said: ${(err as Error).message}`,
          boConflictDetails(tradingInput));
      }
      // Category-level rejection (prose only — eBay has no stable id): the
      // seller turns offers off; the app never strips them on an update.
      if (wantsBestOffer && EbayAdapter.isBestOfferRejection(err)) {
        throw new AppError(422, 'BEST_OFFER_UNSUPPORTED',
          'eBay does not allow Best Offer in this listing\'s category — turn off offers for this listing, then save again.');
      }
      throw err;
    }

    logger.info({ userId: this.userId, itemId: marketplaceListingId }, 'eBay listing revised via ReviseFixedPriceItem');
    const warnings = [
      ...(photosEmpty ? [EMPTY_PHOTOS_WARNING] : []),
    ];
    return {
      marketplaceListingId,
      marketplaceUrl,
      status: 'active',
      ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
    };
  }

  /**
   * End a live eBay listing via Trading EndFixedPriceItem. Under Trade-First the
   * ItemID is the listing id — there is no offer to withdraw or DELETE (the old
   * Inventory offer paths 404 on a Trading ItemID).
   */
  async deleteListing(marketplaceListingId: string): Promise<void> {
    const token = await getEbayAccessToken(this.userId);
    await callTradingApi('EndFixedPriceItem', buildEndFixedPriceItemXml(marketplaceListingId, token), token);

    logger.info({ userId: this.userId, itemId: marketplaceListingId }, 'eBay listing ended via EndFixedPriceItem');
  }

  async getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'> {
    try {
      const token = await getEbayAccessToken(this.userId);
      const parsed = await callTradingApi('GetItem', buildGetItemXml(marketplaceListingId, token), token);
      return parseGetItemStatus(parsed);
    } catch (err) {
      // Logging parity with ReverbAdapter (review HIGH-2): the status sweep
      // treats 'unknown' as a safe no-op, so without this line a broken eBay
      // token silently stops reconciliation with no trace anywhere.
      logger.warn({ marketplaceListingId, err }, 'eBay getListingStatus failed — returning unknown');
      return 'unknown';
    }
  }

  /**
   * Read back the live eBay state for a published listing via Trading GetItem,
   * keyed by the Trading ItemID (= marketplaceListingId). Returns item specifics
   * (aspects), Brand/MPN, ListingStatus and price. There is no Inventory offer to
   * read under Trade-First — GetItem is the single source of truth. A read failure
   * (ended/unknown ItemID) reports found:false rather than throwing.
   */
  async getEbayItemVerification(itemId: string): Promise<EbayItemVerification> {
    try {
      const token = await getEbayAccessToken(this.userId);
      const parsed = await callTradingApi('GetItem', buildGetItemXml(itemId, token), token);
      const v = parseGetItemVerification(parsed);
      return { sku: v.sku, found: v.found, aspects: v.aspects, mpn: v.mpn, brand: v.brand, status: v.status, listingId: v.listingId, price: v.price, bestOfferEnabled: v.bestOfferEnabled, bestOfferAutoAcceptPrice: v.bestOfferAutoAcceptPrice, minimumBestOfferPrice: v.minimumBestOfferPrice };
    } catch {
      return { sku: null, found: false, aspects: {}, mpn: null, brand: null, status: null, listingId: null, price: null, bestOfferEnabled: null, bestOfferAutoAcceptPrice: null, minimumBestOfferPrice: null };
    }
  }

  /**
   * Fetch enough of a live eBay listing (via Trading GetItem) to reconstruct a
   * local item+listing when an order arrives for a listing Portage never stored
   * (orphan-order backfill in /orders/sync). Returns found:false on any read
   * failure so the caller can fall back to the order payload.
   */
  async getItemDetail(itemId: string): Promise<EbayItemDetail> {
    try {
      const token = await getEbayAccessToken(this.userId);
      const parsed = await callTradingApi('GetItem', buildGetItemXml(itemId, token), token);
      const v = parseGetItemVerification(parsed);
      const price = v.price != null && v.price !== '' ? Number(v.price) : null;
      return {
        found: v.found,
        title: v.title,
        photos: v.photos,
        price: price != null && Number.isFinite(price) ? price : null,
        brand: v.brand,
        aspects: v.aspects,
      };
    } catch {
      return { found: false, title: null, photos: [], price: null, brand: null, aspects: {} };
    }
  }

  // Analytics API traffic report for a single published listing — impressions,
  // click-through rate, views, transactions, conversion. Requires the user token
  // to carry the sell.analytics.readonly scope (added 2026-06; pre-existing
  // connections must reconnect to re-consent). Returns null when eBay has no
  // record for the listing in the window.
  async getTrafficReport(listingId: string, days = 30): Promise<EbayTrafficReport | null> {
    // eBay traffic data lags ~a day; end the window at yesterday so the range is
    // always fully populated and never rejected as "future".
    const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const to = new Date();
    to.setUTCDate(to.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));

    const metricKeys = ['LISTING_IMPRESSION_TOTAL', 'CLICK_THROUGH_RATE', 'LISTING_VIEWS_TOTAL', 'TRANSACTION', 'SALES_CONVERSION_RATE'];
    const params = new URLSearchParams();
    params.set('dimension', 'LISTING');
    params.set('metric', metricKeys.join(','));
    params.append('filter', 'marketplace_ids:{EBAY_US}');
    params.append('filter', `listing_ids:{${listingId}}`);
    params.append('filter', `date_range:[${ymd(from)}..${ymd(to)}]`);

    const data = await this.request<{
      header?: { metrics?: Array<{ key: string }> };
      records?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: number | null }> }>;
    }>(`/sell/analytics/v1/traffic_report?${params.toString()}`);

    const record = (data.records ?? []).find(
      (r) => r.dimensionValues?.[0]?.value === listingId,
    ) ?? data.records?.[0];
    if (!record) return null;

    // metricValues are positional, parallel to header.metrics; map by key so we
    // are not dependent on eBay's column order.
    const keys = (data.header?.metrics ?? []).map((m) => m.key);
    const valueFor = (key: string): number | null => {
      const i = keys.indexOf(key);
      return i >= 0 ? record.metricValues?.[i]?.value ?? null : null;
    };

    return {
      listingId,
      impressions: valueFor('LISTING_IMPRESSION_TOTAL'),
      clickThroughRate: valueFor('CLICK_THROUGH_RATE'),
      views: valueFor('LISTING_VIEWS_TOTAL'),
      transactions: valueFor('TRANSACTION'),
      salesConversionRate: valueFor('SALES_CONVERSION_RATE'),
      range: { from: ymd(from), to: ymd(to) },
    };
  }

  async getOrders(since?: Date): Promise<MarketplaceOrderResult[]> {
    const params = new URLSearchParams({ limit: '50' });
    if (since) {
      params.set('filter', `creationdate:[${since.toISOString()}..]`);
    }

    type OrdersPage = {
      orders?: Array<{
        orderId: string;
        orderFulfillmentStatus?: string;
        cancelStatus?: { cancelState?: string };
        creationDate?: string;
        buyer: { username: string };
        pricingSummary: {
          total: { value: string; currency: string };
          deliveryCost: { value: string };
        };
        lineItems?: Array<{ legacyItemId: string; title?: string }>;
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
      next?: string;
    };

    // Page through the window — the sync heals can only repair orders this
    // returns, so a hard one-page cap silently strands sellers past 50 orders.
    // MAX_PAGES bounds a runaway `next` chain (500 orders covers the window).
    // Twin of the loop in reverb-adapter.ts getOrders; keep cap/shape changes in sync.
    const MAX_PAGES = 10;
    const allOrders: NonNullable<OrdersPage['orders']> = [];
    let path: string | undefined = `/sell/fulfillment/v1/order?${params}`;
    for (let page = 0; page < MAX_PAGES && path; page++) {
      const data: OrdersPage = await this.request<OrdersPage>(path);
      allOrders.push(...(data.orders ?? []));
      // `next` is absolute — re-anchor it to a path for request().
      path = data.next ? data.next.replace(/^https?:\/\/[^/]+/, '') : undefined;
    }

    return allOrders.map((order) => {
      const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
      const address = shipTo?.contactAddress;

      return {
        marketplaceOrderId: order.orderId,
        marketplaceListingId: order.lineItems?.[0]?.legacyItemId ?? null,
        title: order.lineItems?.[0]?.title,
        buyerUsername: order.buyer.username,
        salePrice: parseFloat(order.pricingSummary.total.value),
        shippingCost: parseFloat(order.pricingSummary.deliveryCost?.value ?? '0'),
        // The Fulfillment API does NOT return the fee amount — its
        // totalFeeBasisAmount is the fee BASIS (item + shipping the fee is
        // calculated FROM), so mapping it here produced negative "profit".
        // Real fees require the Finances API; until then fees are unknown (0).
        marketplaceFees: 0,
        currency: order.pricingSummary.total.currency,
        // eBay's actual sale date. Without this, orders.ts falls back to
        // `new Date()` and every synced order shows today's date.
        soldAt: order.creationDate ? new Date(order.creationDate) : undefined,
        // FULFILLED means the seller shipped it (on eBay or elsewhere) — without
        // this, every synced order shows "needs shipping" forever. A canceled
        // order wins over everything: it must leave the ship queue.
        fulfillmentStatus: order.cancelStatus?.cancelState === 'CANCELED' ? 'canceled' as const
          : order.orderFulfillmentStatus === 'FULFILLED' ? 'shipped' as const : 'unshipped' as const,
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

  /**
   * Category-mismatch guard: is the suggested category's TREE ROOT a plausible
   * home for what the vision scan saw? Multiple roots per vision value —
   * legitimately surprising categories (band-merch tee under Clothing from a
   * `music` scan) must NOT flag. Used only to compute an advisory boolean;
   * never a category source (eBay taxonomy stays the user-facing truth).
   */
  /**
   * Full plausibility check for the mismatch guard. Coarse enum values go
   * through the root table; RICH vision strings (the scan refine path emits
   * eBay-style names like "Audio Cables & Adapters", not the 14-value enum —
   * live 08-13: that fail-open let Baseball Jackets through silently) fall
   * back to token overlap against the suggested leaf + root names. Zero
   * overlap = implausible. Empty/no-token input still fails open.
   */
  static isPlausibleSuggestion(
    visionCategory: string,
    suggestion: { categoryName: string; rootCategoryId: string | null; rootCategoryName: string | null },
  ): boolean {
    const key = visionCategory.trim().toLowerCase();
    if (!key) return true;
    const coarse = ['electronics', 'clothing', 'furniture', 'collectibles', 'sports', 'home',
      'books', 'toys', 'tools', 'automotive', 'jewelry', 'art', 'music', 'other'];
    if (coarse.includes(key)) {
      return suggestion.rootCategoryId ? this.isPlausibleRoot(key, suggestion.rootCategoryId) : true;
    }
    const stem = (w: string) => w.replace(/s$/, '');
    const tokens = key.split(/[^a-z0-9]+/).map(stem).filter(w => w.length > 3);
    if (tokens.length === 0) return true; // garbage/too-short input — fail open
    const hay = `${suggestion.categoryName} ${suggestion.rootCategoryName ?? ''}`
      .toLowerCase().split(/[^a-z0-9]+/).map(stem).filter(Boolean);
    return tokens.some(t => hay.includes(t));
  }

  static isPlausibleRoot(visionCategory: string, rootCategoryId: string): boolean {
    const roots: Record<string, string[]> = {
      // eBay L1 root ids are years-stable. '99' (Everything Else) plausible everywhere.
      electronics: ['293', '58058', '15032', '625', '1249', '619', '11700', '12576', '99'],
      music: ['619', '11233', '45100', '11450', '293', '99'],
      clothing: ['11450', '888', '45100', '99'],
      sports: ['888', '64482', '11450', '220', '99'],
      furniture: ['11700', '20081', '12576', '99'],
      collectibles: ['1', '20081', '45100', '64482', '11116', '260', '237', '99'],
      home: ['11700', '14339', '293', '870', '99'],
      books: ['267', '1', '99'],
      toys: ['220', '237', '1249', '99'],
      tools: ['12576', '11700', '6000', '99'],
      automotive: ['6000', '12576', '99'],
      jewelry: ['281', '20081', '1', '99'],
      art: ['550', '20081', '14339', '1', '99'],
    };
    const plausible = roots[visionCategory.trim().toLowerCase()];
    if (!plausible) return true; // unknown vision value — fail open, never block on garbage
    return plausible.includes(rootCategoryId);
  }

  static async getCategorySuggestion(query: string): Promise<{
    categoryId: string;
    categoryName: string;
    rootCategoryId: string | null;
    rootCategoryName: string | null;
  } | null> {
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
        categoryTreeNodeAncestors?: Array<{
          categoryId: string;
          categoryName: string;
          categoryTreeNodeLevel?: number;
        }>;
      }>;
    };

    const first = data.categorySuggestions?.[0];
    if (!first) return null;

    // The tree root (level 1) is the mismatch-guard signal; ancestors ride the
    // response we already fetch, so this costs no extra Taxonomy call.
    const ancestors = first.categoryTreeNodeAncestors ?? [];
    // Lowest categoryTreeNodeLevel = tree root — but ONLY when every ancestor
    // carries a level; with partial levels an unleveled true root could lose
    // to a leveled non-root. Any missing level → trust eBay's ordering instead
    // (leaf-parent first → root LAST, same assumption as searchCategories'
    // .reverse()).
    const allHaveLevels = ancestors.length > 0 && ancestors.every(a => a.categoryTreeNodeLevel != null);
    const root = allHaveLevels
      ? ancestors.reduce((a, b) => ((a.categoryTreeNodeLevel as number) <= (b.categoryTreeNodeLevel as number) ? a : b))
      : ancestors.length > 0
        ? ancestors[ancestors.length - 1]
        : null;

    return {
      categoryId: first.category.categoryId,
      categoryName: first.category.categoryName,
      rootCategoryId: root?.categoryId ?? null,
      rootCategoryName: root?.categoryName ?? null,
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
