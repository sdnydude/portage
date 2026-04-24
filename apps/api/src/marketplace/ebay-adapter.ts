import { pino } from 'pino';
import { env } from '../lib/env.js';
import { getEbayAccessToken } from './token-manager.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
} from '@portage/shared';

const logger = pino({ name: 'ebay-adapter' });

const CONDITION_MAP: Record<string, string> = {
  new: 'NEW',
  like_new: 'LIKE_NEW',
  good: 'GOOD',
  fair: 'GOOD',
  poor: 'ACCEPTABLE',
};

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
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
        ...options.headers as Record<string, string>,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, path, body: errorBody }, 'eBay API error');
      throw new Error(`eBay API error: ${response.status} on ${path}`);
    }

    if (response.status === 204) return {} as T;

    return response.json() as Promise<T>;
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    const sku = `portage-${Date.now()}`;
    const ebayCondition = CONDITION_MAP[input.condition] ?? 'GOOD';

    await this.request(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: { quantity: 1 },
        },
        condition: ebayCondition,
        product: {
          title: input.title,
          description: input.description,
          imageUrls: input.photos.map((p) => p.url),
          brand: input.brand,
          mpn: input.model,
        },
      }),
    });

    logger.info({ userId: this.userId, sku }, 'eBay inventory item created');

    const categoryId = input.marketplaceSpecific?.categoryId as string | undefined;

    const offerData = await this.request<{ offerId: string }>('/sell/inventory/v1/offer', {
      method: 'POST',
      body: JSON.stringify({
        sku,
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        listingDescription: input.description,
        pricingSummary: {
          price: { value: String(input.price), currency: input.currency },
        },
        categoryId: categoryId ?? '99',
        merchantLocationKey: 'default',
        listingPolicies: {
          fulfillmentPolicyId: input.marketplaceSpecific?.fulfillmentPolicyId,
          paymentPolicyId: input.marketplaceSpecific?.paymentPolicyId,
          returnPolicyId: input.marketplaceSpecific?.returnPolicyId,
        },
      }),
    });

    let listingId: string;
    let status: 'active' | 'draft' | 'pending' = 'draft';

    try {
      const publishResult = await this.request<{ listingId: string }>(
        `/sell/inventory/v1/offer/${offerData.offerId}/publish`,
        { method: 'POST' },
      );
      listingId = publishResult.listingId;
      status = 'active';
      logger.info({ userId: this.userId, listingId }, 'eBay listing published');
    } catch {
      listingId = offerData.offerId;
      status = 'draft';
      logger.warn({ userId: this.userId, offerId: offerData.offerId }, 'eBay listing created as draft — publish failed');
    }

    return {
      marketplaceListingId: listingId,
      marketplaceUrl: `https://www.ebay.com/itm/${listingId}`,
      status,
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    const updates: Record<string, unknown> = {};

    if (input.title) updates.title = input.title;
    if (input.description) updates.listingDescription = input.description;
    if (input.price) {
      updates.pricingSummary = {
        price: { value: String(input.price), currency: input.currency ?? 'USD' },
      };
    }

    await this.request(`/sell/inventory/v1/offer/${marketplaceListingId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    logger.info({ userId: this.userId, marketplaceListingId }, 'eBay listing updated');

    return {
      marketplaceListingId,
      marketplaceUrl: `https://www.ebay.com/itm/${marketplaceListingId}`,
      status: 'active',
    };
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
      params.set('filter', `creationdate:[${since.toISOString()}..}`);
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
}
