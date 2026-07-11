import { createLogger } from '../lib/logger.js';
import { env } from '../lib/env.js';
import { getReverbAccessToken } from './token-manager.js';
import { AppError } from '../middleware/error.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
  ReverbCompListing,
  ReverbCompResult,
} from '@portage/shared';

const logger = createLogger('reverb-adapter');

const REVERB_BASE = 'https://api.reverb.com/api';

/**
 * Seller-profile shipping defaults store camelCase regionCode; the Reverb API
 * wants region_code. Accept both so client-supplied API-shaped rates pass
 * through untouched.
 */
function toReverbShippingRates(rates: unknown[]): unknown[] {
  return rates.map((r) => {
    const rate = r as { regionCode?: string; region_code?: string; rate: unknown };
    return { region_code: rate.region_code ?? rate.regionCode, rate: rate.rate };
  });
}

// Live-verified against GET /api/listing_conditions (2026-07-08). The previous
// map was never validated against the real API — every UUID was invalid, and
// its "new" value was Reverb's actual Non Functioning UUID.
/** Reverb returns state as a plain string in some payloads and {slug} in others. */
function stateSlug(state: unknown): string | undefined {
  if (typeof state === 'string') return state;
  return (state as { slug?: string } | null | undefined)?.slug;
}

const CONDITION_MAP: Record<string, string> = {
  new: '7c3f45de-2ae0-4c81-8400-fdb6b1d74890',       // Brand New
  like_new: 'ac5b9c1e-dc78-466d-b0b3-7cf712967a48',  // Mint
  good: 'f7a3f48c-972a-44c6-b01a-0cd27488d3f6',      // Good
  fair: '98777886-76d0-44c8-865e-bb40e669e934',      // Fair
  poor: '6a9dfcad-600b-46c8-9e08-ce6e5057921e',      // Poor
};

let cachedConditions: Array<{ uuid: string; displayName: string }> | null = null;
let conditionsCachedAt = 0;
const CONDITIONS_TTL = 24 * 60 * 60 * 1000;

export function clearReverbConditionsCache(): void {
  cachedConditions = null;
  conditionsCachedAt = 0;
}

export class ReverbAdapter implements MarketplaceAdapter {
  readonly marketplace = 'reverb' as const;

  constructor(private readonly userId: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const apiToken = await getReverbAccessToken(this.userId);
    const response = await fetch(`${REVERB_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
        'Accept-Version': '3.0',
        ...options.headers as Record<string, string>,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, path, body: errorBody }, 'Reverb API error');
      let message = `Reverb API error: ${response.status} on ${path}`;
      let details: unknown;
      try {
        const parsed = JSON.parse(errorBody) as { message?: string; errors?: unknown };
        if (parsed.message) message = parsed.message;
        details = parsed.errors;
      } catch { /* non-JSON body — keep generic message */ }
      // A Reverb 401/403 is a marketplace-token problem, not a Portage session
      // problem — forwarding it verbatim would trip the web client's JWT-refresh
      // interceptor (which retries any 401). 409 mirrors EBAY_RECONNECT_REQUIRED.
      if (response.status === 401 || response.status === 403) {
        throw new AppError(409, 'REVERB_RECONNECT_REQUIRED', 'Reverb token is invalid or was revoked. Reconnect your Reverb account in Settings.', details);
      }
      throw new AppError(response.status, 'REVERB_API_ERROR', message, details);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    const specific = input.marketplaceSpecific ?? {};
    const conditionUuid = specific.conditionUuid as string
      ?? CONDITION_MAP[input.condition] ?? CONDITION_MAP.good;
    // A stray condition string silently mapping to "good" would misgrade the
    // listing on a live storefront — surface the fallback to the seller.
    const conditionWarning = !specific.conditionUuid && !CONDITION_MAP[input.condition]
      ? `Unrecognized condition "${input.condition}" — listed as Good on Reverb`
      : undefined;

    const body: Record<string, unknown> = {
      make: input.brand ?? '',
      model: input.model ?? '',
      title: input.title,
      description: input.description,
      condition: { uuid: conditionUuid },
      price: { amount: String(input.price), currency: input.currency },
      has_inventory: true,
      inventory: input.quantity ?? 1,
      photos: input.photos.map(p => p.url),
      // Live-vs-draft on Reverb is controlled by this flag, NOT inventory —
      // omitting it silently creates a remote draft. Local drafts never reach
      // the adapter (route-owned shouldPublish gate), so always publish.
      publish: 'true',
    };

    if (specific.categoryUuid) {
      body.categories = [{ uuid: specific.categoryUuid }];
    }
    if (specific.year) body.year = specific.year;
    if (specific.finish) body.finish = specific.finish;
    if (specific.offersEnabled !== undefined) body.offers_enabled = specific.offersEnabled;
    if (specific.shippingRates) {
      body.shipping = { rates: toReverbShippingRates(specific.shippingRates as unknown[]), local: specific.localPickup ?? false };
    }

    const data = await this.request<{ listing: { id: number; state: string; _links?: { web?: { href?: string } } } }>(
      '/listings',
      { method: 'POST', body: JSON.stringify(body) },
    );

    logger.info({ listingId: data.listing.id }, 'Reverb listing created');

    return {
      marketplaceListingId: String(data.listing.id),
      // _links can be absent on shape drift / review-pending responses — never
      // crash a successful publish over the URL.
      marketplaceUrl: data.listing._links?.web?.href ?? `https://reverb.com/item/${data.listing.id}`,
      status: stateSlug(data.listing.state) === 'live' ? 'active' : 'draft',
      warning: conditionWarning,
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    const specific = input.marketplaceSpecific ?? {};
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.description) updates.description = input.description;
    // createListing maps brand/model to make/model; update must too or an
    // item's brand/model edit never reaches the live Reverb listing.
    if (input.brand !== undefined) updates.make = input.brand;
    if (input.model !== undefined) updates.model = input.model;
    if (input.price) updates.price = { amount: String(input.price), currency: input.currency ?? 'USD' };
    const conditionUuid = specific.conditionUuid as string | undefined
      ?? (input.condition ? CONDITION_MAP[input.condition] : undefined);
    if (conditionUuid) updates.condition = { uuid: conditionUuid };
    if (input.quantity !== undefined) {
      updates.inventory = input.quantity;
      updates.has_inventory = true;
    }
    if (input.photos) {
      updates.photos = input.photos.map(p => p.url);
      // Reverb requires this flag to replace/reorder photos on update; a photo
      // DROPPED from the set lingers until its per-image DELETE (below).
      updates.photo_upload_method = 'override_position';
    }
    if (specific.categoryUuid) updates.categories = [{ uuid: specific.categoryUuid }];
    if (specific.year) updates.year = specific.year;
    if (specific.finish) updates.finish = specific.finish;
    if (specific.offersEnabled !== undefined) updates.offers_enabled = specific.offersEnabled;
    if (specific.shippingRates) {
      updates.shipping = { rates: toReverbShippingRates(specific.shippingRates as unknown[]), local: specific.localPickup ?? false };
    }

    const data = await this.request<{ listing?: { state?: string | { slug?: string } } }>(`/listings/${marketplaceListingId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    const slug = stateSlug(data.listing?.state);
    // Trust the PUT response when it reports a state; a 204/empty body means
    // the update took and the listing state is unchanged (treat as active).
    // Terminal states (sold/ended) must NOT read as draft — downstream would
    // think the listing needs re-publishing. Keep active + tell the seller.
    const terminal = slug === 'sold' || slug === 'ended';
    const terminalWarning = terminal ? `Listing is ${slug} on Reverb — the update was accepted but the listing is no longer for sale` : undefined;

    let photoWarning: string | undefined;
    if (input.photos) {
      try {
        photoWarning = await this.deleteStaleImages(marketplaceListingId, input.photos.map(p => p.url));
      } catch (err) {
        // The PUT already succeeded — throwing here would make the route report
        // "failed to sync" for an update Reverb accepted. Degrade to a warning.
        logger.warn({ marketplaceListingId, err }, 'Reverb stale-photo cleanup failed');
        photoWarning = 'Removed photos may still appear on Reverb — the photo cleanup call failed';
      }
    }

    return {
      marketplaceListingId,
      marketplaceUrl: `https://reverb.com/item/${marketplaceListingId}`,
      status: slug && slug !== 'live' && !terminal ? 'draft' : 'active',
      warning: [terminalWarning, photoWarning].filter(Boolean).join('; ') || undefined,
    };
  }

  /**
   * override_position only replaces/reorders positions — a photo dropped from
   * the set lingers on the live listing until its per-image DELETE. Diff by
   * original_url: Reverb echoes the source URL each image was uploaded from
   * (live-pinned shape: GET /listings/:id/images → {images:[{id, original_url}]}).
   * Images with no original_url (e.g. uploaded via the Reverb dashboard) are
   * left alone. A single failed DELETE doesn't abort the rest — returns a
   * warning counting what was left behind, undefined when everything cleaned.
   */
  private async deleteStaleImages(listingId: string, keepUrls: string[]): Promise<string | undefined> {
    const keep = new Set(keepUrls);
    const data = await this.request<{ images?: Array<{ id: number; original_url?: string }> }>(
      `/listings/${listingId}/images`,
    );
    const stale = (data.images ?? []).filter(img => img.original_url && !keep.has(img.original_url));
    let failed = 0;
    for (const img of stale) {
      try {
        await this.request(`/listings/${listingId}/images/${img.id}`, { method: 'DELETE' });
      } catch (err) {
        failed++;
        logger.warn({ listingId, imageId: img.id, err }, 'Reverb stale-image delete failed');
      }
    }
    return failed ? `${failed} removed photo(s) could not be deleted on Reverb` : undefined;
  }

  async deleteListing(marketplaceListingId: string): Promise<void> {
    await this.request(`/listings/${marketplaceListingId}`, { method: 'DELETE' });
  }

  async getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'> {
    try {
      const data = await this.request<{ state: string | { slug?: string } }>(`/listings/${marketplaceListingId}`);
      switch (stateSlug(data.state)) {
        case 'live': return 'active';
        case 'sold': return 'sold';
        case 'ended': return 'ended';
        default: return 'unknown';
      }
    } catch (err) {
      // Includes REVERB_SETUP_REQUIRED / decrypt failures from per-call token
      // resolution — log before collapsing to the sentinel or a disconnected
      // account is indistinguishable from a Reverb outage.
      logger.warn({ marketplaceListingId, err }, 'Reverb getListingStatus failed — returning unknown');
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
    if (cachedConditions && Date.now() - conditionsCachedAt < CONDITIONS_TTL) return cachedConditions;

    const response = await fetch(`${REVERB_BASE}/listing_conditions`, {
      headers: { 'Accept': 'application/hal+json', 'Accept-Version': '3.0' },
    });

    if (!response.ok) {
      throw new AppError(response.status, 'REVERB_API_ERROR', `Failed to fetch Reverb conditions: ${response.status}`);
    }

    const data = await response.json() as {
      conditions: Array<{ uuid: string; display_name: string }>;
    };

    cachedConditions = data.conditions.map(c => ({
      uuid: c.uuid,
      displayName: c.display_name,
    }));
    conditionsCachedAt = Date.now();

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
      return { listings: [], stats: { median: null, avg: null, sampleSize: 0 }, degraded: true };
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
