import { AppError } from '../middleware/error.js';
import { createLogger } from '../lib/logger.js';
/**
 * Trading API XML builders for the listing lifecycle (Trade-First refactor, Option B).
 * Pure functions: typed input → request XML. Terms INLINE (Decision 5):
 * no <SellerProfiles>, no <PaymentMethods>, inline ReturnsNotAccepted + Calculated
 * buyer-paid USPS. ConditionID numeric (N2). Account must be opted OUT of Business Policies.
 */
import { escapeXml } from './ebay-trading-client.js';

const logger = createLogger('ebay-trading-builders');

const XML_DECL = '<?xml version="1.0" encoding="utf-8"?>';
const NS = 'urn:ebay:apis:eBLBaseComponents';

export interface TradingListingInput {
  title: string;
  categoryId: string;
  price: number;
  currency: string;
  quantity: number;
  conditionId: string;
  conditionDescription?: string;
  description: string;
  sku?: string;
  pictureUrls: string[];
  /** Set ONLY by the adapter after surfacing the keep-old-pictures warning —
   *  lets a zero-photo item still sync its other fields via Revise. */
  allowEmptyPictures?: boolean;
  aspects: Record<string, string[]>;
  shipping: {
    originPostalCode: string;
    weightMajor: number;
    weightMinor: number;
    dimensions: { length: number; width: number; height: number };
    service?: string;
    /** eBay ShippingPackage enum (required for calculated); defaults to PackageThickEnvelope. */
    shippingPackage?: string;
    /** Shipping shape (live-verified 2026-08-01); absent = calculated (legacy). */
    method?: 'calculated' | 'flat' | 'free';
    /** Buyer-paid flat rate; required when method='flat'. */
    flatCost?: number;
    /** Offer local pickup ALONGSIDE the method (add-on only — pickup-only is
     *  illegal on eBay, live-verified 2026-08-01). */
    pickupOffered?: boolean;
  };
  dispatchTimeMax?: number;
  /** Per-listing "accept offers" toggle — enables Best Offer even with no floor. */
  bestOfferEnabled?: boolean;
  bestOfferAutoAcceptPrice?: number;
  /** Auto-DECLINE floor (offers below are rejected without seller review). */
  minimumBestOfferPrice?: number;
  // Trading Revise semantics: an OMITTED field keeps the value stored on the
  // live listing — clearing a Best Offer threshold requires an explicit
  // DeletedField entry (error 23004 repro: price lowered to/below a stored
  // BestOfferAutoAcceptPrice can only be fixed by deleting the field).
  deleteBestOfferAutoAcceptPrice?: boolean;
  deleteMinimumBestOfferPrice?: boolean;
  listingDuration?: string;
}

// eBay Trading hard limits on PictureURL (PictureDetailsType): max 24 URLs
// per listing and a 3975-character budget across ALL URL values. Throwing
// here beats letting eBay reject the whole Add/Revise with an opaque XML
// error mid-publish.
export function validatePictureUrls(urls: string[]): void {
  // AppError(400), not plain Error: the create/publish routes hand unknown
  // errors to the generic 500 handler, which would bury these actionable
  // messages under "Internal server error".
  if (urls.length > 24) {
    throw new AppError(400, 'EBAY_PICTURE_LIMIT', `eBay allows at most 24 photos per listing (got ${urls.length}) — remove ${urls.length - 24}.`);
  }
  const totalChars = urls.reduce((n, u) => n + u.length, 0);
  if (totalChars > 3975) {
    throw new AppError(400, 'EBAY_PICTURE_LIMIT', `Combined photo URL length ${totalChars} exceeds eBay's 3975-character PictureURL budget — remove or shorten photos.`);
  }
}

function pictureDetails(urls: string[]): string {
  if (urls.length === 0) return '';
  validatePictureUrls(urls);
  // PictureSource=Vendor tells eBay these are self-hosted (Cloudflare R2) URLs, not
  // EPS references — without it eBay treats them as EPS and rejects them.
  return `<PictureDetails><PictureSource>Vendor</PictureSource>${urls.map(u => `<PictureURL>${escapeXml(u)}</PictureURL>`).join('')}</PictureDetails>`;
}

function itemSpecifics(aspects: Record<string, string[]>): string {
  const lists = Object.entries(aspects)
    .filter(([, vals]) => vals.length > 0)
    .map(([name, vals]) =>
      `<NameValueList><Name>${escapeXml(name)}</Name>${vals.map(v => `<Value>${escapeXml(v)}</Value>`).join('')}</NameValueList>`,
    );
  return lists.length === 0 ? '' : `<ItemSpecifics>${lists.join('')}</ItemSpecifics>`;
}

/** Inline Calculated shipping (Decision 5). Weight/dims now live in ShippingPackageDetails
 * (schema-verified — they are deprecated inside CalculatedShippingRate); this container
 * carries only the origin ZIP and the buyer-paid USPS service option. */
function inlineShipping(s: TradingListingInput['shipping'], currency: string): string {
  const service = s.service ?? 'USPSPriority';
  const method = s.method ?? 'calculated';
  // Local pickup rides as a SECOND service option next to the real method —
  // add-on only; pickup-only is rejected by eBay (live-verified 2026-08-01).
  const pickupOption = s.pickupOffered
    ? '<ShippingServiceOptions><ShippingServicePriority>2</ShippingServicePriority><ShippingService>Pickup</ShippingService></ShippingServiceOptions>'
    : '';
  if (method === 'flat' || method === 'free') {
    // Live-verified shapes (2026-08-01 matrix, PR #274): Flat + ShippingServiceCost,
    // no CalculatedShippingRate; free adds FreeShipping with an explicit 0.00 cost.
    const cost = method === 'free' ? 0 : s.flatCost ?? 0;
    return (
      '<ShippingDetails>' +
      '<ShippingType>Flat</ShippingType>' +
      '<ShippingServiceOptions>' +
      '<ShippingServicePriority>1</ShippingServicePriority>' +
      `<ShippingService>${service}</ShippingService>` +
      `<ShippingServiceCost currencyID="${currency}">${cost.toFixed(2)}</ShippingServiceCost>` +
      (method === 'free' ? '<FreeShipping>true</FreeShipping>' : '') +
      '</ShippingServiceOptions>' +
      pickupOption +
      '</ShippingDetails>'
    );
  }
  return (
    '<ShippingDetails>' +
    '<ShippingType>Calculated</ShippingType>' +
    '<CalculatedShippingRate>' +
    `<OriginatingPostalCode>${escapeXml(s.originPostalCode)}</OriginatingPostalCode>` +
    '</CalculatedShippingRate>' +
    '<ShippingServiceOptions>' +
    '<ShippingServicePriority>1</ShippingServicePriority>' +
    `<ShippingService>${service}</ShippingService>` +
    '</ShippingServiceOptions>' +
    pickupOption +
    '</ShippingDetails>'
  );
}

/** Package weight + dimensions for Calculated shipping, in Item.ShippingPackageDetails
 * (eBay deprecated these inside CalculatedShippingRate). MeasureType units are lbs/oz/in
 * (NOT lbs/ozs/inches). ShippingPackage is required for calculated shipping. */
function shippingPackageDetails(s: TradingListingInput['shipping']): string {
  // Flat/free with no stored weight: keep the block anyway (operator decision,
  // 2026-08-01) — floor weight to 1oz so the package DIMENSIONS still reach eBay.
  const zeroWeight = s.weightMajor === 0 && s.weightMinor === 0;
  const method = s.method ?? 'calculated';
  const weightMinor = method !== 'calculated' && zeroWeight ? 1 : s.weightMinor;
  // All-zero dims (flat/free with nothing stored) — omit the dimension tags
  // rather than send an unverified zeros shape; known dims always carry through.
  const d = s.dimensions;
  const hasDims = d.length > 0 || d.width > 0 || d.height > 0;
  return (
    '<ShippingPackageDetails>' +
    '<MeasurementUnit>English</MeasurementUnit>' +
    (hasDims
      ? `<PackageDepth unit="in">${d.height}</PackageDepth>` +
        `<PackageLength unit="in">${d.length}</PackageLength>` +
        `<PackageWidth unit="in">${d.width}</PackageWidth>`
      : '') +
    `<WeightMajor unit="lbs">${s.weightMajor}</WeightMajor>` +
    `<WeightMinor unit="oz">${weightMinor}</WeightMinor>` +
    `<ShippingPackage>${escapeXml(s.shippingPackage ?? 'PackageThickEnvelope')}</ShippingPackage>` +
    '</ShippingPackageDetails>'
  );
}

/** Best Offer auto-accept (G9): only when floor is positive and below the BIN price. */
function bestOfferDetails(input: TradingListingInput): string {
  // Explicit disable (BO-4): seller turned Best Offer off — the only path
  // that clears live state. Revise omission would keep eBay's stored value,
  // so the toggle-off must be sent explicitly (thresholds are cleared by the
  // DeletedField entries the caller sets alongside this flag).
  if (input.bestOfferEnabled === false) {
    return '<BestOfferDetails><BestOfferEnabled>false</BestOfferEnabled></BestOfferDetails>';
  }
  const floor = input.bestOfferAutoAcceptPrice;
  const hasFloor = typeof floor === 'number' && floor > 0 && floor < input.price;
  // A valid auto-accept floor implies Best Offer; the per-listing toggle
  // (bestOfferEnabled) enables it with no floor — seller reviews every offer.
  if (!hasFloor && !input.bestOfferEnabled) return '';
  const enabled = '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>';
  const min = input.minimumBestOfferPrice;
  const hasMin = typeof min === 'number' && min > 0 && min < input.price;
  // Defense-in-depth only (BO-3): the route pre-flight rejects invalid
  // thresholds with a 422 before any build. Reaching this drop means a
  // caller bypassed validation — never silent, always logged.
  if ((typeof floor === 'number' && !hasFloor) || (typeof min === 'number' && !hasMin)) {
    logger.warn({ price: input.price, bestOfferAutoAcceptPrice: floor, minimumBestOfferPrice: min }, 'Invalid Best Offer threshold reached the XML builder — dropped defensively; pre-flight should have rejected this');
  }
  // BestOfferAutoAcceptPrice auto-ACCEPTS offers at/above the floor;
  // MinimumBestOfferPrice auto-DECLINES offers below it. Both live in
  // ListingDetails; invalid values are dropped rather than sent for rejection.
  const details =
    (hasFloor ? `<BestOfferAutoAcceptPrice currencyID="${input.currency}">${floor}</BestOfferAutoAcceptPrice>` : '') +
    (hasMin ? `<MinimumBestOfferPrice currencyID="${input.currency}">${min}</MinimumBestOfferPrice>` : '');
  return details ? `${enabled}<ListingDetails>${details}</ListingDetails>` : enabled;
}

/** Split total ounces (items store normalized oz) into eBay WeightMajor (lbs) + WeightMinor (oz). */
export function splitOunces(totalOz: number): { weightMajor: number; weightMinor: number } {
  const rounded = Math.round(totalOz);
  return { weightMajor: Math.floor(rounded / 16), weightMinor: rounded % 16 };
}

type ParsedXml = Record<string, unknown>;

function getPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** ItemID from an AddFixedPriceItemResponse — present even on Warning/PartialFailure (M7). */
export function parseAddItemResponse(parsed: ParsedXml): string | null {
  const id = getPath(parsed, ['AddFixedPriceItemResponse', 'ItemID']);
  return id == null ? null : String(id);
}

/** Map GetItem SellingStatus.ListingStatus to the adapter's status union. */
export function parseGetItemStatus(parsed: ParsedXml): 'active' | 'sold' | 'ended' | 'unknown' {
  const selling = getPath(parsed, ['GetItemResponse', 'Item', 'SellingStatus']) as
    | { ListingStatus?: string; QuantitySold?: number }
    | undefined;
  const status = selling?.ListingStatus;
  if (status === 'Active') return 'active';
  if (status === 'Completed') return (selling?.QuantitySold ?? 0) > 0 ? 'sold' : 'ended';
  if (status === 'Ended') return 'ended';
  return 'unknown';
}

export interface GetItemVerification {
  found: boolean;
  sku: string | null;
  aspects: Record<string, string[]>;
  mpn: string | null;
  brand: string | null;
  status: string | null;
  listingId: string | null;
  price: string | null;
  title: string | null;
  photos: string[];
  // Live Best Offer state (BO-3) — feeds the conflict-time heal. Parsed from
  // Item.BestOfferDetails / Item.ListingDetails; shape inferred from the
  // StartPrice attr-or-scalar pattern, live-verification pending.
  bestOfferEnabled: boolean | null;
  bestOfferAutoAcceptPrice: number | null;
  minimumBestOfferPrice: number | null;
}

/** Read back the live item state from a GetItem response: item specifics (aspects),
 * Brand/MPN, ListingStatus, ItemID and price. Used by the F-GATE verification route. */
export function parseGetItemVerification(parsed: ParsedXml): GetItemVerification {
  const empty: GetItemVerification = { found: false, sku: null, aspects: {}, mpn: null, brand: null, status: null, listingId: null, price: null, title: null, photos: [], bestOfferEnabled: null, bestOfferAutoAcceptPrice: null, minimumBestOfferPrice: null };
  const item = getPath(parsed, ['GetItemResponse', 'Item']) as Record<string, unknown> | undefined;
  if (!item) return empty;

  // Attr-or-scalar money value ({ '@_currencyID', '#text' } or bare) → number.
  const moneyNum = (raw: unknown): number | null => {
    if (raw == null) return null;
    const text = typeof raw === 'object' ? (raw as Record<string, unknown>)['#text'] : raw;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  };

  const aspects: Record<string, string[]> = {};
  const nvlRaw = getPath(item, ['ItemSpecifics', 'NameValueList']);
  const nvls = Array.isArray(nvlRaw) ? nvlRaw : nvlRaw != null ? [nvlRaw] : [];
  for (const nvl of nvls) {
    const name = (nvl as Record<string, unknown>)?.Name;
    const value = (nvl as Record<string, unknown>)?.Value;
    if (typeof name !== 'string') continue;
    const vals = (Array.isArray(value) ? value : [value]).filter((v) => v != null).map((v) => String(v));
    if (vals.length > 0) aspects[name] = vals;
  }
  const byLower = new Map(Object.keys(aspects).map((k) => [k.toLowerCase(), k]));
  const aspectVal = (name: string): string | null => {
    const key = byLower.get(name.toLowerCase());
    return key ? aspects[key][0] ?? null : null;
  };

  const selling = getPath(item, ['SellingStatus']) as Record<string, unknown> | undefined;
  // StartPrice (and CurrentPrice) parse as { '@_currencyID', '#text' } with attributes on,
  // or as a bare scalar when there are no attributes.
  const priceRaw = getPath(item, ['StartPrice']) ?? getPath(selling ?? {}, ['CurrentPrice']);
  let price: string | null = null;
  if (priceRaw != null) {
    const text = typeof priceRaw === 'object' ? (priceRaw as Record<string, unknown>)['#text'] : priceRaw;
    price = text != null ? String(text) : null;
  }

  const picRaw = getPath(item, ['PictureDetails', 'PictureURL']);
  const photos = (Array.isArray(picRaw) ? picRaw : picRaw != null ? [picRaw] : [])
    .filter((u) => u != null)
    .map((u) => String(u));

  return {
    found: true,
    sku: item.SKU != null ? String(item.SKU) : null,
    aspects,
    mpn: aspectVal('MPN'),
    brand: aspectVal('Brand'),
    status: selling?.ListingStatus != null ? String(selling.ListingStatus) : null,
    listingId: item.ItemID != null ? String(item.ItemID) : null,
    price,
    title: item.Title != null ? String(item.Title) : null,
    photos,
    bestOfferEnabled: (() => {
      const raw = getPath(item, ['BestOfferDetails', 'BestOfferEnabled']);
      return raw == null ? null : String(raw) === 'true';
    })(),
    bestOfferAutoAcceptPrice: moneyNum(getPath(item, ['ListingDetails', 'BestOfferAutoAcceptPrice'])),
    minimumBestOfferPrice: moneyNum(getPath(item, ['ListingDetails', 'MinimumBestOfferPrice'])),
  };
}

export function buildGetItemXml(itemId: string, token: string): string {
  return (
    `${XML_DECL}\n<GetItemRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<ItemID>${escapeXml(itemId)}</ItemID>` +
    '</GetItemRequest>'
  );
}

export function buildGetMyeBaySellingXml(pageNumber: number, token: string): string {
  return (
    `${XML_DECL}\n<GetMyeBaySellingRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage>` +
    `<PageNumber>${pageNumber}</PageNumber></Pagination></ActiveList>` +
    '<DetailLevel>ReturnAll</DetailLevel>' +
    '</GetMyeBaySellingRequest>'
  );
}

export function buildEndFixedPriceItemXml(itemId: string, token: string): string {
  return (
    `${XML_DECL}\n<EndFixedPriceItemRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<ItemID>${escapeXml(itemId)}</ItemID>` +
    '<EndingReason>NotAvailable</EndingReason>' +
    '</EndFixedPriceItemRequest>'
  );
}

export function buildReviseInventoryStatusXml(
  itemId: string,
  patch: { price?: number; quantity?: number; currency: string },
  token: string,
): string {
  const status =
    `<ItemID>${escapeXml(itemId)}</ItemID>` +
    (typeof patch.price === 'number' ? `<StartPrice currencyID="${patch.currency}">${patch.price}</StartPrice>` : '') +
    (typeof patch.quantity === 'number' ? `<Quantity>${patch.quantity}</Quantity>` : '');
  return (
    `${XML_DECL}\n<ReviseInventoryStatusRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<InventoryStatus>${status}</InventoryStatus>` +
    '</ReviseInventoryStatusRequest>'
  );
}

/** Shared inline <Item> body for AddFixedPriceItem and ReviseFixedPriceItem. */
function itemBody(input: TradingListingInput): string {
  return (
    `<Title>${escapeXml(input.title)}</Title>` +
    `<Description>${escapeXml(input.description)}</Description>` +
    `<PrimaryCategory><CategoryID>${escapeXml(input.categoryId)}</CategoryID></PrimaryCategory>` +
    `<StartPrice currencyID="${input.currency}">${input.price}</StartPrice>` +
    `<Quantity>${input.quantity}</Quantity>` +
    '<ListingType>FixedPriceItem</ListingType>' +
    `<ListingDuration>${input.listingDuration ?? 'GTC'}</ListingDuration>` +
    `<ConditionID>${escapeXml(input.conditionId)}</ConditionID>` +
    // eBay forbids ConditionDescription on brand-new (1000) items — "The
    // ConditionDescription field is not valid for new items", live revise
    // failure 2026-08-05. New-other (1500) still allows it.
    (input.conditionDescription && input.conditionId !== '1000' ? `<ConditionDescription>${escapeXml(input.conditionDescription)}</ConditionDescription>` : '') +
    (input.sku ? `<SKU>${escapeXml(input.sku)}</SKU>` : '') +
    '<Country>US</Country>' +
    `<Currency>${input.currency}</Currency>` +
    `<PostalCode>${escapeXml(input.shipping.originPostalCode)}</PostalCode>` +
    `<DispatchTimeMax>${input.dispatchTimeMax ?? 1}</DispatchTimeMax>` +
    pictureDetails(input.pictureUrls) +
    itemSpecifics(input.aspects) +
    '<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>' +
    inlineShipping(input.shipping, input.currency) +
    shippingPackageDetails(input.shipping) +
    bestOfferDetails(input)
  );
}

export function buildAddFixedPriceItemXml(input: TradingListingInput, token: string): string {
  return (
    `${XML_DECL}\n<AddFixedPriceItemRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<Item>${itemBody(input)}</Item>` +
    '</AddFixedPriceItemRequest>'
  );
}

/** Same payload as AddFixedPriceItem, but eBay only VALIDATES it — no listing is created.
 * Used as a pre-flight dry-run before the real publish (live-only proof de-risk). */
export function buildVerifyAddFixedPriceItemXml(input: TradingListingInput, token: string): string {
  return (
    `${XML_DECL}\n<VerifyAddFixedPriceItemRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<Item>${itemBody(input)}</Item>` +
    '</VerifyAddFixedPriceItemRequest>'
  );
}

export function buildReviseFixedPriceItemXml(itemId: string, input: TradingListingInput, token: string): string {
  // An empty PictureURL list makes pictureDetails() emit nothing, and eBay's
  // omitted-field Revise semantics silently KEEP the old pictures live while
  // the app shows none. The adapter opts in explicitly (allowEmptyPictures)
  // when it has surfaced that divergence as a user-facing warning — any other
  // empty-photos revise fails loud instead of diverging silently.
  if (input.pictureUrls.length === 0 && !input.allowEmptyPictures) {
    throw new AppError(400, 'EBAY_PICTURE_LIMIT', 'Refusing to revise an eBay listing with zero photos — eBay would silently keep the old pictures. Add a photo first.');
  }
  const deletedFields =
    (input.deleteBestOfferAutoAcceptPrice ? '<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>' : '') +
    (input.deleteMinimumBestOfferPrice ? '<DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>' : '');
  return (
    `${XML_DECL}\n<ReviseFixedPriceItemRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<Item><ItemID>${escapeXml(itemId)}</ItemID>${itemBody(input)}</Item>` +
    deletedFields +
    '</ReviseFixedPriceItemRequest>'
  );
}
