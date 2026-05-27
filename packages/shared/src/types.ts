import type { MarketplaceType } from './marketplace.js';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  subscriptionTier: 'free' | 'pro';
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

export interface MarketplaceData {
  ebay?: MarketplaceCacheEntry;
  etsy?: MarketplaceCacheEntry;
  reverb?: MarketplaceCacheEntry;
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
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  estimatedValueRecommended?: number;
  aiConfidenceScore: number;
  marketplaceData?: MarketplaceData;
  createdAt: Date;
  updatedAt: Date;
}

export interface Listing {
  id: string;
  itemId: string;
  userId: string;
  marketplace: 'ebay' | 'etsy' | 'reverb';
  marketplaceListingId?: string;
  marketplaceSpecificFields?: Record<string, unknown>;
  status: 'draft' | 'active' | 'sold' | 'archived';
  price: number;
  currency: string;
  createdAt: Date;
  publishedAt?: Date;
  soldAt?: Date;
}

export interface Order {
  id: string;
  listingId: string;
  itemId: string;
  userId: string;
  marketplace: 'ebay' | 'etsy' | 'reverb';
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
  marketplace: 'ebay' | 'etsy' | 'reverb';
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
export type ShippingProviderType = 'shippo' | 'easypost' | 'pirate_ship';

export interface ShippingPreset {
  id: string;
  userId: string;
  name: string;
  packageType: PackageType;
  length: number;
  width: number;
  height: number;
  weightLbs: number;
  weightOz: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShippingProvider {
  id: string;
  userId: string;
  provider: ShippingProviderType;
  isActive: boolean;
  createdAt: Date;
}

export interface ShippingRate {
  rateId: string;
  carrier: string;
  service: string;
  price: number;
  currency: string;
  estimatedDays: number;
  source: 'marketplace' | 'shippo' | 'easypost' | 'pirate_ship';
}

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
  features: string[];
  estimatedValueLow: number;
  estimatedValueHigh: number;
  confidence: number;
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
  photos: Array<{ url: string; key: string; width?: number; height?: number; isPrimary?: boolean }>;
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

  price: number | null;
  pricingStrategy: PricingStrategy;
  acceptOffers: boolean;
  minimumOfferPrice: number | null;
  comps: CompResult | null;
  compsStatus: 'idle' | 'loading' | 'loaded' | 'failed';

  marketplace: 'ebay' | 'etsy' | 'reverb';

  shippingMethod: ShippingMethod;
  shippingCost: number | null;
  packageSize: PackageSize;
  weight: number | null;

  draftId: string | null;
  publishStatus: 'idle' | 'publishing' | 'published' | 'failed';
  listingId: string | null;
  inventoryItemId: string | null;
}

export interface ListingDraft {
  id: string;
  userId: string;
  itemId: string | null;
  marketplace: 'ebay' | 'etsy' | 'reverb';
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
  reverbOffersEnabled: boolean;
  reverbDefaultShipping: ReverbShippingDefaults | null;
  shipFromAddress: ShipFromAddress | null;
  defaultWeightUnit: WeightUnit;
  defaultDimensionUnit: DimensionUnit;
  defaultPackageType: PackageType;
  preferredMarketplaces: MarketplaceType[];
  autoPublish: boolean;
  defaultCurrency: string;
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
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  merchantLocationKey: string;
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
}

export interface EbayPolicy {
  policyId: string;
  name: string;
  description?: string;
}

export interface EbayPoliciesResponse {
  fulfillment: EbayPolicy[];
  payment: EbayPolicy[];
  returnPolicy: EbayPolicy[];
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
  voiceTranscript?: string;
}

export interface AudioPlayback {
  url: string;
  duration?: number;
}

export type TextDeltaEvent = { type: 'text_delta'; text: string };
export type ToolStartEvent = { type: 'tool_start'; toolId: string; toolName: string };
export type ToolResultEvent = { type: 'tool_result'; toolId: string; toolName: string; structured?: unknown };
export type ActionPillsEvent = { type: 'action_pills'; pills: ActionPill[] };
export type AudioEvent = { type: 'audio_url'; url: string };
export type DoneEvent = { type: 'done'; conversationId: string; model: string; inputTokens: number; outputTokens: number };
export type ErrorEvent = { type: 'error'; message: string };

export type StreamEvent =
  | TextDeltaEvent
  | ToolStartEvent
  | ToolResultEvent
  | ActionPillsEvent
  | AudioEvent
  | DoneEvent
  | ErrorEvent;
