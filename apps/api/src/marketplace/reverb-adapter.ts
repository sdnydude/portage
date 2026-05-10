import { pino } from 'pino';
import { env } from '../lib/env.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
  ReverbCompListing,
  ReverbCompResult,
} from '@portage/shared';

const logger = pino({ name: 'reverb-adapter' });

const REVERB_BASE = 'https://api.reverb.com/api';

const CONDITION_MAP: Record<string, string> = {
  new: 'fbf35668-96a0-4baa-bcde-ab18d6b1b329',
  like_new: 'ac5b9c1e-dc78-466d-b0b3-a19b46876097',
  good: 'f7a3f48c-972a-44c6-b01a-0cd27488d3ab',
  fair: '98777886-76d0-44a8-8e36-e0b8884c4c6f',
  poor: 'cda44a45-f57a-4891-a29e-a75e0afb8df0',
};

let cachedConditions: Array<{ uuid: string; displayName: string }> | null = null;

export class ReverbAdapter implements MarketplaceAdapter {
  readonly marketplace = 'reverb' as const;

  constructor(private readonly apiToken: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${REVERB_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
        'Accept-Version': '3.0',
        ...options.headers as Record<string, string>,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, path, body: errorBody }, 'Reverb API error');
      throw new Error(`Reverb API error: ${response.status} on ${path}`);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    const specific = input.marketplaceSpecific ?? {};
    const conditionUuid = specific.conditionUuid as string
      ?? CONDITION_MAP[input.condition] ?? CONDITION_MAP.good;

    const body: Record<string, unknown> = {
      make: input.brand ?? '',
      model: input.model ?? '',
      title: input.title,
      description: input.description,
      condition: { uuid: conditionUuid },
      price: { amount: String(input.price), currency: input.currency },
      has_inventory: true,
      inventory: 1,
      photos: input.photos.map(p => p.url),
    };

    if (specific.categoryUuid) {
      body.categories = [{ uuid: specific.categoryUuid }];
    }
    if (specific.year) body.year = specific.year;
    if (specific.finish) body.finish = specific.finish;
    if (specific.offersEnabled !== undefined) body.offers_enabled = specific.offersEnabled;
    if (specific.shippingRates) {
      body.shipping = { rates: specific.shippingRates, local: specific.localPickup ?? false };
    }

    const data = await this.request<{ listing: { id: number; state: string; _links: { web: { href: string } } } }>(
      '/listings',
      { method: 'POST', body: JSON.stringify(body) },
    );

    logger.info({ listingId: data.listing.id }, 'Reverb listing created');

    return {
      marketplaceListingId: String(data.listing.id),
      marketplaceUrl: data.listing._links.web.href,
      status: data.listing.state === 'live' ? 'active' : 'draft',
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.description) updates.description = input.description;
    if (input.price) updates.price = { amount: String(input.price), currency: input.currency ?? 'USD' };

    await this.request(`/listings/${marketplaceListingId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    return {
      marketplaceListingId,
      marketplaceUrl: `https://reverb.com/item/${marketplaceListingId}`,
      status: 'active',
    };
  }

  async deleteListing(marketplaceListingId: string): Promise<void> {
    await this.request(`/listings/${marketplaceListingId}`, { method: 'DELETE' });
  }

  async getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'> {
    try {
      const data = await this.request<{ state: string }>(`/listings/${marketplaceListingId}`);
      switch (data.state) {
        case 'live': return 'active';
        case 'sold': return 'sold';
        case 'ended': return 'ended';
        default: return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  async getOrders(since?: Date): Promise<MarketplaceOrderResult[]> {
    const params = new URLSearchParams();
    if (since) params.set('created_after', since.toISOString());

    const data = await this.request<{
      orders?: Array<{
        order_number: string;
        listing_id?: string;
        buyer_name: string;
        amount_product: { amount: string; currency: string };
        shipping: { amount: string };
        shipping_address?: {
          name: string;
          street_address: string;
          extended_address?: string;
          locality: string;
          region: string;
          postal_code: string;
          country_code: string;
        };
      }>;
    }>(`/my/orders/selling?${params}`);

    return (data.orders ?? []).map(order => ({
      marketplaceOrderId: order.order_number,
      marketplaceListingId: order.listing_id ?? null,
      buyerUsername: order.buyer_name,
      salePrice: parseFloat(order.amount_product.amount),
      shippingCost: parseFloat(order.shipping?.amount ?? '0'),
      marketplaceFees: 0,
      currency: order.amount_product.currency,
      shippingAddress: {
        name: order.shipping_address?.name ?? '',
        street1: order.shipping_address?.street_address ?? '',
        street2: order.shipping_address?.extended_address,
        city: order.shipping_address?.locality ?? '',
        state: order.shipping_address?.region ?? '',
        zip: order.shipping_address?.postal_code ?? '',
        country: order.shipping_address?.country_code ?? 'US',
      },
    }));
  }

  async searchCategories(query: string): Promise<MarketplaceCategoryResult[]> {
    const data = await this.request<{
      categories?: Array<{
        uuid: string;
        full_name: string;
      }>;
    }>(`/categories/flat?query=${encodeURIComponent(query)}`);

    return (data.categories ?? []).map(cat => ({
      id: cat.uuid,
      name: cat.full_name,
      path: cat.full_name.split(' > '),
      isLeaf: true,
    }));
  }

  static async getConditions(): Promise<Array<{ uuid: string; displayName: string }>> {
    if (cachedConditions) return cachedConditions;

    const response = await fetch(`${REVERB_BASE}/listing_conditions`, {
      headers: { 'Accept': 'application/hal+json', 'Accept-Version': '3.0' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Reverb conditions: ${response.status}`);
    }

    const data = await response.json() as {
      conditions: Array<{ uuid: string; display_name: string }>;
    };

    cachedConditions = data.conditions.map(c => ({
      uuid: c.uuid,
      displayName: c.display_name,
    }));

    return cachedConditions;
  }

  static async searchComps(query: string): Promise<ReverbCompResult> {
    const token = env().REVERB_API_TOKEN;
    if (!token) {
      return { listings: [], stats: { median: null, avg: null, sampleSize: 0 } };
    }

    const response = await fetch(
      `${REVERB_BASE}/comparison_shopping_pages?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/hal+json',
          'Accept-Version': '3.0',
        },
      },
    );

    if (!response.ok) {
      logger.error({ status: response.status, query }, 'Reverb comps search failed');
      return { listings: [], stats: { median: null, avg: null, sampleSize: 0 } };
    }

    const data = await response.json() as {
      comparison_shopping_pages?: Array<{
        title: string;
        estimated_value?: { price_center?: { amount: string; currency: string } };
        _links?: { web?: { href: string } };
      }>;
    };

    const pages = data.comparison_shopping_pages ?? [];
    const listings: ReverbCompListing[] = pages.map(p => ({
      title: p.title,
      price: parseFloat(p.estimated_value?.price_center?.amount ?? '0'),
      currency: p.estimated_value?.price_center?.currency ?? 'USD',
      condition: 'Various',
      imageUrl: null,
      listingUrl: p._links?.web?.href ?? '',
    })).filter(l => l.price > 0);

    const prices = listings.map(l => l.price);
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length === 0 ? null
      : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const avg = prices.length === 0 ? null
      : Math.round(prices.reduce((s, p) => s + p, 0) / prices.length * 100) / 100;

    return {
      listings,
      stats: { median, avg, sampleSize: listings.length },
    };
  }
}
