/**
 * Trading API XML builders for the listing lifecycle (Trade-First refactor, Option B).
 * Pure functions: typed input → request XML. Terms INLINE (Decision 5):
 * no <SellerProfiles>, no <PaymentMethods>, inline ReturnsNotAccepted + Calculated
 * buyer-paid USPS. ConditionID numeric (N2). Account must be opted OUT of Business Policies.
 */
import { escapeXml } from './ebay-trading-client.js';

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
  aspects: Record<string, string[]>;
  shipping: {
    originPostalCode: string;
    weightMajor: number;
    weightMinor: number;
    dimensions: { length: number; width: number; height: number };
    service?: string;
    /** eBay ShippingPackage enum (required for calculated); defaults to PackageThickEnvelope. */
    shippingPackage?: string;
  };
  dispatchTimeMax?: number;
  bestOfferAutoAcceptPrice?: number;
  listingDuration?: string;
}

function pictureDetails(urls: string[]): string {
  if (urls.length === 0) return '';
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
function inlineShipping(s: TradingListingInput['shipping']): string {
  const service = s.service ?? 'USPSPriority';
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
    '</ShippingDetails>'
  );
}

/** Package weight + dimensions for Calculated shipping, in Item.ShippingPackageDetails
 * (eBay deprecated these inside CalculatedShippingRate). MeasureType units are lbs/oz/in
 * (NOT lbs/ozs/inches). ShippingPackage is required for calculated shipping. */
function shippingPackageDetails(s: TradingListingInput['shipping']): string {
  return (
    '<ShippingPackageDetails>' +
    '<MeasurementUnit>English</MeasurementUnit>' +
    `<PackageDepth unit="in">${s.dimensions.height}</PackageDepth>` +
    `<PackageLength unit="in">${s.dimensions.length}</PackageLength>` +
    `<PackageWidth unit="in">${s.dimensions.width}</PackageWidth>` +
    `<WeightMajor unit="lbs">${s.weightMajor}</WeightMajor>` +
    `<WeightMinor unit="oz">${s.weightMinor}</WeightMinor>` +
    `<ShippingPackage>${escapeXml(s.shippingPackage ?? 'PackageThickEnvelope')}</ShippingPackage>` +
    '</ShippingPackageDetails>'
  );
}

/** Best Offer auto-accept (G9): only when floor is positive and below the BIN price. */
function bestOfferDetails(input: TradingListingInput): string {
  const floor = input.bestOfferAutoAcceptPrice;
  if (typeof floor !== 'number' || floor <= 0 || floor >= input.price) return '';
  // BestOfferAutoAcceptPrice auto-ACCEPTS offers at/above the floor. (MinimumBestOfferPrice
  // is a different field — the auto-DECLINE floor — which we deliberately do not set.)
  return (
    '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>' +
    `<ListingDetails><BestOfferAutoAcceptPrice currencyID="${input.currency}">${floor}</BestOfferAutoAcceptPrice></ListingDetails>`
  );
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

export function buildGetItemXml(itemId: string, token: string): string {
  return (
    `${XML_DECL}\n<GetItemRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<ItemID>${escapeXml(itemId)}</ItemID>` +
    '</GetItemRequest>'
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
    (input.conditionDescription ? `<ConditionDescription>${escapeXml(input.conditionDescription)}</ConditionDescription>` : '') +
    (input.sku ? `<SKU>${escapeXml(input.sku)}</SKU>` : '') +
    '<Country>US</Country>' +
    `<Currency>${input.currency}</Currency>` +
    `<PostalCode>${escapeXml(input.shipping.originPostalCode)}</PostalCode>` +
    `<DispatchTimeMax>${input.dispatchTimeMax ?? 1}</DispatchTimeMax>` +
    pictureDetails(input.pictureUrls) +
    itemSpecifics(input.aspects) +
    '<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>' +
    inlineShipping(input.shipping) +
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

export function buildReviseFixedPriceItemXml(itemId: string, input: TradingListingInput, token: string): string {
  return (
    `${XML_DECL}\n<ReviseFixedPriceItemRequest xmlns="${NS}">` +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    `<Item><ItemID>${escapeXml(itemId)}</ItemID>${itemBody(input)}</Item>` +
    '</ReviseFixedPriceItemRequest>'
  );
}
