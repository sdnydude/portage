export type MarketplaceType = 'ebay' | 'etsy';

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
  features?: string[];
  shippingWeight?: number;
  shippingWeightUnit?: 'oz' | 'lb' | 'g' | 'kg';
  marketplaceSpecific?: Record<string, unknown>;
}

export interface MarketplaceListingResult {
  marketplaceListingId: string;
  marketplaceUrl: string;
  status: 'active' | 'draft' | 'pending';
}

export interface MarketplaceOrderResult {
  marketplaceOrderId: string;
  buyerUsername: string;
  salePrice: number;
  shippingCost: number;
  marketplaceFees: number;
  currency: string;
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
