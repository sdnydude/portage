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
  marketplace: 'ebay' | 'etsy';
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
  marketplace: 'ebay' | 'etsy';
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
  marketplace: 'ebay' | 'etsy';
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
  marketplaceUserId?: string;
  createdAt: Date;
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
