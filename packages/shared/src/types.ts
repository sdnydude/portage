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

export interface Item {
  id: string;
  userId: string;
  photos: string[];
  title: string;
  description: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  features: string[];
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  estimatedValueRecommended?: number;
  aiConfidenceScore: number;
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

  marketplace: 'ebay' | 'reverb' | 'etsy';

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
  marketplace: 'ebay' | 'reverb' | 'etsy';
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
