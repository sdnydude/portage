export type MarketplaceType = 'ebay' | 'reverb';

export interface MarketplaceListingInput {
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  condition: string;
  photos: { url: string; isPrimary?: boolean }[];
  brand?: string;
  model?: string;
  // Manufacturer Part Number — a real part/SKU number, never the model name.
  // eBay rejects the model name as MPN (error 25002).
  mpn?: string | null;
  features?: string[];
  quantity?: number;
  publishMode?: 'draft' | 'live';
  ebaySku?: string;
  shippingWeight?: number;
  shippingWeightUnit?: 'oz' | 'lb' | 'g' | 'kg';
  marketplaceSpecific?: Record<string, unknown>;
}

export interface MarketplaceListingResult {
  marketplaceListingId: string;
  marketplaceUrl?: string;
  status: 'active' | 'draft' | 'pending';
  warning?: string;
  ebaySku?: string;
}

export interface MarketplaceOrderResult {
  marketplaceOrderId: string;
  marketplaceListingId: string | null;
  /** Line-item title from the marketplace, used to backfill a local item when the
   *  listing isn't in Portage and a full item read (e.g. eBay GetItem) is unavailable. */
  title?: string;
  buyerUsername: string;
  salePrice: number;
  shippingCost: number;
  marketplaceFees: number;
  currency: string;
  soldAt?: Date;
  /** Normalized marketplace fulfillment state: 'shipped' when the marketplace
   *  reports the order fulfilled; undefined when the marketplace gives no signal. */
  fulfillmentStatus?: 'shipped' | 'unshipped';
  shippingAddress: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface MarketplaceCategoryResult {
  id: string;
  name: string;
  path: string[];
  isLeaf: boolean;
}

export interface MarketplaceAdapter {
  readonly marketplace: MarketplaceType;
  createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult>;
  updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult>;
  deleteListing(marketplaceListingId: string): Promise<void>;
  getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'>;
  getOrders(since?: Date): Promise<MarketplaceOrderResult[]>;
  searchCategories(query: string): Promise<MarketplaceCategoryResult[]>;
}
