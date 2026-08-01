import type { MarketplaceType } from './marketplace.js';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  subscriptionTier: 'free' | 'pro' | 'beta-tester';
  stripeCustomerId?: string;
  aiScansThisMonth: number;
  bgRemovalsThisMonth: number;
  scanCountResetAt: Date;
  onboardingCompleted: boolean;
  address?: Address;
  notificationPreferences?: NotificationPreferences;
  milestonesAchieved: string[];
  createdAt: Date;
}

export interface Address {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface NotificationPreferences {
  sale: boolean;
  buyerMessage: boolean;
  listingExpiry: boolean;
  priceAlert: boolean;
  shippingReminder: boolean;
  pushEnabled: boolean;
}

export interface ItemPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
}

export interface MarketplaceCacheEntry {
  categoryId: string | null;
  categoryName: string | null;
  title: string | null;
  cachedAt: string;
}

// Reverb's cache slot carries UUIDs and gear attributes rather than eBay's
// numeric category ids — populated at prepare time, consumed by the publish
// route's enrichment block.
export interface ReverbCacheEntry {
  categoryUuid: string | null;
  categoryName: string | null;
  conditionUuid: string | null;
  conditionName: string | null;
  year: string | null;
  finish: string | null;
  cachedAt: string;
}

export interface MarketplaceData {
  ebay?: MarketplaceCacheEntry;
  reverb?: ReverbCacheEntry;
}

export interface Item {
  id: string;
  userId: string;
  photos: ItemPhoto[];
  title: string;
  description: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  conditionNotes: string;
  brand: string;
  model: string;
  features: string[];
  // eBay item specifics keyed → string[] (Brand, MPN, category aspects). Filled at
  // scan, carried into publish. Defaults to {} for existing rows.
  aspects?: Record<string, string[]>;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  estimatedValueRecommended?: number;
  // Seller-set sale price (distinct from the AI estimate). Prefills the editable
  // price field on every eBay publish; null/undefined means unset.
  price?: number | null;
  aiConfidenceScore: number;
  quantity: number;
  // eBay Calculated shipping (error 25020): normalized weight in ounces,
  // dimensions in inches. weightEstimated marks AI-populated vs seller-confirmed.
  weightOz?: number | null;
  lengthIn?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
  ebayPackageType?: string | null;
  weightEstimated?: boolean;
  marketplaceData?: MarketplaceData;
  createdAt: Date;
  updatedAt: Date;
}

export interface Listing {
  id: string;
  itemId: string;
  userId: string;
  marketplace: 'ebay' | 'reverb';
  marketplaceListingId?: string;
  marketplaceSpecificFields?: Record<string, unknown>;
  status: 'draft' | 'active' | 'sold' | 'archived';
  price: number;
  currency: string;
  ebaySku?: string;
  ebayOfferId?: string;
  createdAt: Date;
  publishedAt?: Date;
  soldAt?: Date;
}

export interface Order {
  id: string;
  listingId: string;
  itemId: string;
  userId: string;
  marketplace: 'ebay' | 'reverb';
  marketplaceOrderId: string;
  buyerUsername: string;
  salePrice: number;
  shippingCost: number;
  marketplaceFees: number;
  currency: string;
  status: 'payment_received' | 'label_purchased' | 'shipped' | 'delivered';
  trackingNumber?: string;
  carrier?: string;
  shippingLabelUrl?: string;
  shippingAddress?: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  soldAt: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: Record<string, unknown>[];
  toolResults?: Record<string, unknown>[];
  actionsTaken?: string[];
}

export type MessageDirection = 'inbound' | 'outbound';
export type EbayMessageType = 'asq' | 'rtq' | 'aaq';

export interface EbayMessage {
  id: string;
  userId: string;
  ebayMessageId: string;
  conversationKey: string;
  buyerUsername: string;
  itemId: string;
  itemTitle?: string;
  subject: string;
  body: string;
  direction: MessageDirection;
  messageType: EbayMessageType;
  readAt?: Date;
  ebayCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EbayConversation {
  conversationKey: string;
  buyerUsername: string;
  itemId: string;
  itemTitle?: string;
  lastMessageBody: string | null;
  lastMessageAt: string;
  unreadCount: number;
  messageCount: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'sale' | 'buyer_message' | 'listing_expiry' | 'price_alert' | 'shipping_reminder';
  title: string;
  body: string;
  referenceType?: 'order' | 'listing' | 'item';
  referenceId?: string;
  read: boolean;
  createdAt: Date;
}

export interface MarketplaceAccount {
  id: string;
  userId: string;
  marketplace: 'ebay' | 'reverb';
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
  marketplaceUserId?: string;
  createdAt: Date;
}

export interface CompListing {
  title: string;
  price: number;
  currency: string;
  condition: string;
  imageUrl: string | null;
  listingUrl: string;
  soldDate: string | null;
}

export interface CompStats {
  soldMedian: number | null;
  soldAvg: number | null;
  activeMedian: number | null;
  activeAvg: number | null;
  sampleSize: number;
  /**
   * Market-shape percentiles over the RAW sold pool (no condition filtering) —
   * for display/context only. Listing-price bands come from the prepare-listing
   * pricing engine, which uses a condition-selected pool; do not mix the two.
   */
  p25?: number | null;
  p50?: number | null;
  p75?: number | null;
  /** sold / (sold + active); null when there are no comps at all. */
  sellThrough?: number | null;
}

export interface CompResult {
  sold: CompListing[];
  active: CompListing[];
  stats: CompStats;
  partial?: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: Omit<User, 'milestonesAchieved' | 'scanCountResetAt'>;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ShipFromAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export type PackageType = 'box' | 'envelope' | 'poly_mailer';

export interface DisclaimerAcceptance {
  id: string;
  userId: string;
  listingId: string;
  disclaimerVersion: number;
  acceptedAt: Date;
  ipAddress?: string;
}

export interface RecognitionCandidate {
  name: string;
  description: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  conditionNotes: string;
  brand: string | null;
  model: string | null;
  mpn?: string | null;
  aspects?: Record<string, string[]>;
  features: string[];
  estimatedValueLow: number;
  estimatedValueHigh: number;
  confidence: number;
  // AI-estimated packaged shipping weight (oz) + box dimensions (in) from the scan.
  weight?: { value: number; unit: string };
  dimensions?: { length: number; width: number; height: number; unit: string };
  packageType?: string;
}

export interface RecognitionResult {
  candidates: RecognitionCandidate[];
  reasoning: string[];
}

export type ListingInterface = 'conversational' | 'swipe' | 'hybrid';
export type ListingForkPref = 'ask' | 'list' | 'inventory';
export type PricingStrategy = 'fast' | 'market' | 'max' | 'custom';
export type ShippingMethod = 'calculated' | 'flat' | 'free';
export type PackageSize = 'small' | 'medium' | 'large' | 'custom';

export interface ListingFlowState {
  photos: ItemPhoto[];
  primaryPhotoIndex: number;

  recognition: {
    status: 'idle' | 'recognizing' | 'complete' | 'failed';
    candidates: RecognitionCandidate[];
    selectedIndex: number;
    reasoning: string[];
    confidence: number;
  };

  title: string;
  description: string;
  category: string;
  categoryPath: string[];
  condition: string;
  brand: string;
  model: string;
  features: string[];
  quantity: number;

  price: number | null;
  pricingStrategy: PricingStrategy;
  comps: CompResult | null;
  compsStatus: 'idle' | 'loading' | 'loaded' | 'failed';

  marketplace: 'ebay' | 'reverb';

  shippingMethod: ShippingMethod;
  shippingCost: number | null;
  /** True once the seller explicitly set method/cost — only then does publish
   *  emit ebayShipping (untouched keeps server defaults). Persisted so a
   *  restored draft keeps the intent; absent on legacy drafts = untouched. */
  shippingTouched?: boolean;
  packageSize: PackageSize;
  // weight stays decimal pounds (existing flow consumers); dimensions are inches.
  // ebayPackageType is the eBay enum (MAILING_BOX/LETTER/...), distinct from packageSize.
  weight: number | null;
  dimLength: number | null;
  dimWidth: number | null;
  dimHeight: number | null;
  ebayPackageType: string | null;
  // true while weight/dims are AI-estimated and unconfirmed; any manual edit
  // flips it false so the persisted item records seller-confirmed metrics.
  weightEstimated: boolean;

  draftId: string | null;
  publishStatus: 'idle' | 'publishing' | 'published' | 'failed';
  listingId: string | null;
  inventoryItemId: string | null;
  // Set when the listing row was created but the marketplace publish fell back
  // to draft (e.g. eBay rejected it) — carries the marketplace's actual reason.
  publishWarning: string | null;
  // Dedup key for POST /listings, scoped as `${itemId}:${marketplace}:${random}`.
  // Reused verbatim on retry so the server collides on (userId, idempotencyKey)
  // and resumes the stuck row instead of inserting an orphan draft per attempt;
  // cleared on success. Optional: drafts persisted before this field existed
  // resume with it undefined.
  publishIdempotencyKey?: string | null;
}

export interface ListingDraft {
  id: string;
  userId: string;
  itemId: string | null;
  marketplace: 'ebay' | 'reverb';
  title: string | null;
  price: number | null;
  status: string;
  lastStepCompleted: string | null;
  flowState: ListingFlowState;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  listingInterface: ListingInterface;
  listingForkPref: ListingForkPref;
  listingForkCount: number;
  listingCompactMode: boolean;
  /** F3b: true while the publish terms sheet is suppressed (7-day window, current version). */
  disclaimerSuppressed?: boolean;
}

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export type WeightUnit = 'oz' | 'lb' | 'g' | 'kg';
export type DimensionUnit = 'in' | 'cm';

export interface SellerProfile {
  id: string;
  userId: string;
  ebayFulfillmentPolicyId: string | null;
  ebayPaymentPolicyId: string | null;
  ebayReturnPolicyId: string | null;
  ebayMerchantLocationKey: string | null;
  ebayPublishMode: 'draft' | 'live';
  reverbOffersEnabled: boolean;
  reverbDefaultShipping: ReverbShippingDefaults | null;
  shipFromAddress: ShipFromAddress | null;
  defaultWeightUnit: WeightUnit;
  defaultDimensionUnit: DimensionUnit;
  defaultPackageType: PackageType;
  preferredMarketplaces: MarketplaceType[];
  autoPublish: boolean;
  defaultCurrency: string;
  pricingSuggestPercentile: number;
  pricingFloorPercentile: number;
  bestOfferAutoAcceptEnabled: boolean;
  gtcAutoEnd: boolean;
  defaultListingFooter: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReverbShippingDefaults {
  rates: Array<{ regionCode: string; rate: { amount: string; currency: string } }>;
  local: boolean;
}

export interface PricingData {
  suggested: number;
  low: number;
  high: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  basedOn: number;
  conditionMatch: 'exact' | 'nearby' | 'all';
  /**
   * Best-Offer auto-accept floor from the SAME comp pool as `suggested`
   * (engine invariant — never recompute from a different pool). null/absent
   * when the pool is too small (n<3) or the floor would invert.
   */
  bestOfferFloor?: number | null;
}

export interface ReverbCompListing {
  title: string;
  price: number;
  currency: string;
  condition: string;
  imageUrl: string | null;
  listingUrl: string;
}

export interface ReverbCompResult {
  listings: ReverbCompListing[];
  stats: {
    median: number | null;
    avg: number | null;
    sampleSize: number;
  };
  // True when the comps API call itself failed (outage/rate-limit) — the empty
  // result then means "couldn't ask", not "no comparable listings exist".
  degraded?: boolean;
}

export interface EbayPreparedFields {
  title: string;
  categoryId: string;
  categoryName: string;
  condition: string;
  conditionDescription: string;
  aspects: Record<string, string[]>;
  upc: string | null;
  epid: string | null;
  weight: { value: number; unit: string };
  dimensions: { length: number; width: number; height: number; unit: string };
  packageType: string;
  /** Best-Offer auto-accept floor (seller opted in); flows to the adapter via marketplaceSpecific. */
  bestOfferAutoAcceptPrice?: number;
}

/**
 * Per-listing eBay shipping choice (beta 17be7322), persisted verbatim under
 * marketplaceSpecificFields.ebayShipping. Grouped so it can never collide with
 * mergeItemShipping's flat weight/dimensions/packageType keys. Absent key =
 * no explicit choice — the calculated-shipping defaults apply, and legacy
 * rows keep their pre-feature behavior.
 */
export interface EbayListingShipping {
  method: ShippingMethod;
  /** Buyer-paid flat rate in listing currency; required when method='flat'. */
  flatCost?: number;
  /** eBay ShippingService enum value; absent → USPSPriority. */
  service?: string;
  /** Handling time in days → Trading DispatchTimeMax; absent → 1. */
  handlingDays?: number;
}

/**
 * Per-listing Reverb shipping choice, persisted verbatim under
 * marketplaceSpecificFields.reverbShipping and applied AFTER seller-profile
 * fill in applyReverbEnrichment (same explicit-override pattern as
 * offersEnabledExplicit). Absent key = profile defaults keep flowing on sync.
 */
export interface ReverbListingShipping {
  /** Explicit Reverb shipping-profile choice (wins over profile defaults + rates). */
  profileId?: string;
  /** Drop profile/rates entirely and publish shipping{local:true}. */
  localPickupOnly?: boolean;
}

export interface ReverbPreparedFields {
  make: string;
  model: string;
  title: string;
  categoryUuid: string;
  categoryName: string;
  conditionUuid: string;
  conditionName: string;
  year: string | null;
  finish: string | null;
  description: string;
  shippingRates: Array<{ regionCode: string; rate: { amount: string; currency: string } }>;
  offersEnabled: boolean;
}

export interface PreparedListingData {
  title: string;
  description: string;
  condition: ItemCondition;
  conditionDescription: string;
  brand: string;
  model: string;
  pricing: PricingData;
  comps: {
    ebay: CompResult | null;
    reverb: ReverbCompResult | null;
  };
  ebay: EbayPreparedFields | null;
  reverb: ReverbPreparedFields | null;
  isMusicGear: boolean;
  aiConfidence: number;
  warnings: string[];
  /** Seller's default footer — display-only in previews; appended server-side at publish. */
  listingFooter?: string | null;
}

// ─── Porter rich content blocks (SSE streaming protocol) ──

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ActionPill {
  label: string;
  message: string;
}

export interface RichMessage {
  role: 'user' | 'assistant';
  blocks: ContentBlock[];
}

export type TextDeltaEvent = { type: 'text_delta'; text: string };
export type ToolStartEvent = { type: 'tool_start'; toolId: string; toolName: string };
export type ToolResultEvent = { type: 'tool_result'; toolId: string; toolName: string; structured?: unknown };
export type ActionPillsEvent = { type: 'action_pills'; pills: ActionPill[] };
export type DoneEvent = { type: 'done'; conversationId: string; model: string; inputTokens: number; outputTokens: number };
export type ErrorEvent = { type: 'error'; message: string };

export type StreamEvent =
  | TextDeltaEvent
  | ToolStartEvent
  | ToolResultEvent
  | ActionPillsEvent
  | DoneEvent
  | ErrorEvent;
