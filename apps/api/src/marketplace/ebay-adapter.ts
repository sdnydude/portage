import { createLogger } from '../lib/logger.js';
import { env } from '../lib/env.js';
import { AppError } from '../middleware/error.js';
import { getEbayAccessToken, getEbayProdAppToken, invalidateEbayProdAppToken } from './token-manager.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
  CompListing,
  CompResult,
} from '@portage/shared';

const logger = createLogger('ebay-adapter');

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

export interface EbayListingFields {
  categoryId: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

export function validateEbayListingFields(specific: Record<string, unknown>): EbayListingFields {
  const categoryId = specific.categoryId as string | undefined;
  if (!categoryId || categoryId === '99') {
    throw new AppError(400, 'EBAY_CATEGORY_REQUIRED', 'A valid eBay leaf category is required to list this item.');
  }
  const merchantLocationKey = specific.merchantLocationKey as string | undefined;
  const fulfillmentPolicyId = specific.fulfillmentPolicyId as string | undefined;
  const paymentPolicyId = specific.paymentPolicyId as string | undefined;
  const returnPolicyId = specific.returnPolicyId as string | undefined;
  if (!merchantLocationKey || !fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new AppError(400, 'EBAY_SETUP_REQUIRED', 'eBay selling is not set up. Run "Set up eBay Selling" in Settings first.');
  }
  return { categoryId, merchantLocationKey, fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
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
    const sku = `portage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const specific = input.marketplaceSpecific ?? {};
    const ebayCondition = resolveEbayCondition(input.condition, specific);
    const fields = validateEbayListingFields(specific);

    const product: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      imageUrls: input.photos.map((p) => p.url),
    };

    if (input.brand) product.brand = input.brand;
    if (input.model) product.mpn = input.model;
    if (specific.upc) product.upc = [specific.upc as string];
    if (specific.epid) product.epid = specific.epid;
    if (specific.aspects) product.aspects = specific.aspects;

    const inventoryItem: Record<string, unknown> = {
      availability: { shipToLocationAvailability: { quantity: input.quantity ?? 1 } },
      condition: ebayCondition,
      product,
    };

    if (specific.conditionDescription) {
      inventoryItem.conditionDescription = specific.conditionDescription;
    }

    if (specific.weight || specific.dimensions) {
      const pkg: Record<string, unknown> = {};
      if (specific.weight) {
        pkg.weight = specific.weight;
      }
      if (specific.dimensions) {
        pkg.dimensions = specific.dimensions;
      }
      if (specific.packageType) {
        pkg.packageType = specific.packageType;
      }
      inventoryItem.packageWeightAndSize = pkg;
    }

    await this.request(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      body: JSON.stringify(inventoryItem),
    });

    logger.info({ userId: this.userId, sku }, 'eBay inventory item created');

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
        categoryId: fields.categoryId,
        merchantLocationKey: fields.merchantLocationKey,
        listingPolicies: {
          fulfillmentPolicyId: fields.fulfillmentPolicyId,
          paymentPolicyId: fields.paymentPolicyId,
          returnPolicyId: fields.returnPolicyId,
        },
      }),
    });

    let listingId: string;
    let status: 'active' | 'draft' | 'pending' = 'draft';

    let marketplaceUrl: string | undefined;
    let warning: string | undefined;

    try {
      const publishResult = await this.request<{ listingId: string }>(
        `/sell/inventory/v1/offer/${offerData.offerId}/publish`,
        { method: 'POST' },
      );
      listingId = publishResult.listingId;
      status = 'active';
      marketplaceUrl = `https://www.ebay.com/itm/${listingId}`;
      logger.info({ userId: this.userId, listingId }, 'eBay listing published');
    } catch (err) {
      listingId = offerData.offerId;
      status = 'draft';
      warning = 'Listing created as draft — publish to eBay failed. You can publish manually from your eBay seller hub.';
      logger.warn({ userId: this.userId, offerId: offerData.offerId, err: (err as Error).message }, 'eBay listing created as draft — publish failed');
    }

    return {
      marketplaceListingId: listingId,
      marketplaceUrl,
      status,
      warning,
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
        lineItems?: Array<{ legacyItemId: string }>;
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
        marketplaceListingId: order.lineItems?.[0]?.legacyItemId ?? null,
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

    return {
      sold,
      active,
      stats: {
        soldMedian: median(soldPrices),
        soldAvg: avg(soldPrices),
        activeMedian: median(activePrices),
        activeAvg: avg(activePrices),
        sampleSize: sold.length + active.length,
      },
      ...(partial && { partial: true }),
    };
  }

  static async getCategorySuggestion(query: string): Promise<{ categoryId: string; categoryName: string } | null> {
    const token = await getEbayProdAppToken();

    const response = await fetch(
      `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
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
      }>;
    };

    const first = data.categorySuggestions?.[0];
    if (!first) return null;

    return {
      categoryId: first.category.categoryId,
      categoryName: first.category.categoryName,
    };
  }

  static async getRequiredAspects(categoryId: string): Promise<Record<string, { required: boolean; values: string[] | null }>> {
    const token = await getEbayProdAppToken();

    const response = await fetch(
      `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
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
        aspectConstraint?: { aspectRequired?: boolean };
        aspectValues?: Array<{ localizedValue: string }>;
      }>;
    };

    const result: Record<string, { required: boolean; values: string[] | null }> = {};
    for (const aspect of data.aspects ?? []) {
      result[aspect.localizedAspectName] = {
        required: aspect.aspectConstraint?.aspectRequired ?? false,
        values: aspect.aspectValues?.map(v => v.localizedValue) ?? null,
      };
    }

    return result;
  }
}
