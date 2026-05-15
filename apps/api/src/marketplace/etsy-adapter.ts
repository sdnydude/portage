import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { marketplaceAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { decrypt, encrypt } from '../lib/crypto.js';
import { env } from '../lib/env.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
} from '@portage/shared';

const logger = createLogger('etsy-adapter');

const ETSY_BASE = 'https://api.etsy.com/v3';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const CONDITION_MAP: Record<string, string> = {
  new: 'is_new',
  like_new: 'is_new',
  good: 'is_used',
  fair: 'is_used',
  poor: 'is_used',
};

const shopIdCache = new Map<string, { shopId: string; cachedAt: number }>();
const SHOP_ID_TTL = 60 * 60 * 1000;

export class EtsyAdapter implements MarketplaceAdapter {
  readonly marketplace = 'etsy' as const;

  constructor(private readonly userId: string) {}

  private async getAccessToken(): Promise<string> {
    const [account] = await db.select()
      .from(marketplaceAccounts)
      .where(and(
        eq(marketplaceAccounts.userId, this.userId),
        eq(marketplaceAccounts.marketplace, 'etsy'),
      ))
      .limit(1);

    if (!account) throw new Error('No Etsy account connected');

    const expiresAt = new Date(account.tokenExpiresAt).getTime();

    if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
      return decrypt(account.accessTokenEncrypted);
    }

    logger.info({ userId: this.userId }, 'Refreshing Etsy access token');

    const config = env();
    if (!config.ETSY_API_KEY) throw new Error('Etsy API key not configured');

    const refreshToken = decrypt(account.refreshTokenEncrypted);

    const response = await fetch(`${ETSY_BASE}/public/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.ETSY_API_KEY,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, body: errorBody }, 'Etsy token refresh failed');
      throw new Error('Failed to refresh Etsy access token');
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await db.update(marketplaceAccounts)
      .set({
        accessTokenEncrypted: encrypt(data.access_token),
        refreshTokenEncrypted: encrypt(data.refresh_token),
        tokenExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceAccounts.id, account.id));

    return data.access_token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const config = env();

    const response = await fetch(`${ETSY_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': config.ETSY_API_KEY!,
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, path, body: errorBody }, 'Etsy API error');
      throw new Error(`Etsy API error: ${response.status} on ${path}`);
    }

    if (response.status === 204) return {} as T;

    return response.json() as Promise<T>;
  }

  private async getShopId(): Promise<string> {
    const cached = shopIdCache.get(this.userId);
    if (cached && Date.now() - cached.cachedAt < SHOP_ID_TTL) return cached.shopId;

    const data = await this.request<{ user_id: number; shop_id: number }>(
      '/application/users/me',
    );

    const shopData = await this.request<{ shop_id: number }>(
      `/application/users/${data.user_id}/shops`,
    );

    const shopId = String(shopData.shop_id);
    shopIdCache.set(this.userId, { shopId, cachedAt: Date.now() });
    return shopId;
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    const shopId = await this.getShopId();

    const whoMade = (input.marketplaceSpecific?.whoMade as string) ?? 'someone_else';
    const whenMade = (input.marketplaceSpecific?.whenMade as string) ?? '2020_2025';
    const taxonomyId = input.marketplaceSpecific?.taxonomyId as number | undefined;

    const data = await this.request<{ listing_id: number; url: string; state: string }>(
      `/application/shops/${shopId}/listings`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: input.title.substring(0, 140),
          description: input.description,
          price: input.price,
          quantity: 1,
          who_made: whoMade,
          when_made: whenMade,
          taxonomy_id: taxonomyId ?? 1,
          is_supply: false,
          type: 'physical',
          shipping_profile_id: input.marketplaceSpecific?.shippingProfileId,
          ...(input.condition ? { item_condition: CONDITION_MAP[input.condition] ?? 'is_used' } : {}),
        }),
      },
    );

    let photosFailed = 0;
    for (const photo of input.photos) {
      try {
        const imageResponse = await fetch(photo.url);
        const imageBlob = await imageResponse.blob();

        const formData = new FormData();
        formData.append('image', imageBlob, 'photo.jpg');

        const token = await this.getAccessToken();
        const uploadRes = await fetch(`${ETSY_BASE}/application/shops/${shopId}/listings/${data.listing_id}/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': env().ETSY_API_KEY!,
          },
          body: formData,
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.text().catch(() => '');
          logger.warn({ listingId: data.listing_id, photoUrl: photo.url, status: uploadRes.status, body }, 'Etsy photo upload HTTP error');
          photosFailed++;
        }
      } catch (err) {
        logger.warn({ listingId: data.listing_id, photoUrl: photo.url, err: (err as Error).message }, 'Failed to upload photo to Etsy');
        photosFailed++;
      }
    }

    logger.info({ userId: this.userId, listingId: data.listing_id, photosFailed }, 'Etsy listing created');

    return {
      marketplaceListingId: String(data.listing_id),
      marketplaceUrl: data.url,
      status: data.state === 'active' ? 'active' : 'draft',
      ...(photosFailed > 0 ? { warning: `${photosFailed} of ${input.photos.length} photos failed to upload` } : {}),
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    const shopId = await this.getShopId();
    const updates: Record<string, unknown> = {};

    if (input.title) updates.title = input.title.substring(0, 140);
    if (input.description) updates.description = input.description;
    if (input.price) updates.price = input.price;

    const data = await this.request<{ listing_id: number; url: string; state: string }>(
      `/application/shops/${shopId}/listings/${marketplaceListingId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
    );

    logger.info({ userId: this.userId, marketplaceListingId }, 'Etsy listing updated');

    return {
      marketplaceListingId: String(data.listing_id),
      marketplaceUrl: data.url,
      status: data.state === 'active' ? 'active' : 'draft',
    };
  }

  async deleteListing(marketplaceListingId: string): Promise<void> {
    const shopId = await this.getShopId();

    await this.request(
      `/application/shops/${shopId}/listings/${marketplaceListingId}`,
      { method: 'DELETE' },
    );

    logger.info({ userId: this.userId, marketplaceListingId }, 'Etsy listing deleted');
  }

  async getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'> {
    try {
      const data = await this.request<{ state: string }>(
        `/application/listings/${marketplaceListingId}`,
      );

      switch (data.state) {
        case 'active': return 'active';
        case 'sold_out': return 'sold';
        case 'removed':
        case 'expired': return 'ended';
        default: return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  async getOrders(since?: Date): Promise<MarketplaceOrderResult[]> {
    const shopId = await this.getShopId();
    const params = new URLSearchParams({ limit: '25' });
    if (since) {
      params.set('min_created', String(Math.floor(since.getTime() / 1000)));
    }

    const data = await this.request<{
      results?: Array<{
        receipt_id: number;
        buyer_user_id: number;
        name: string;
        grandtotal: { amount: number; divisor: number; currency_code: string };
        total_shipping_cost: { amount: number; divisor: number };
        transactions?: Array<{ listing_id: number }>;
        first_line: string;
        second_line?: string;
        city: string;
        state: string;
        zip: string;
        country_iso: string;
      }>;
    }>(`/application/shops/${shopId}/receipts?${params}`);

    return (data.results ?? []).map((receipt) => ({
      marketplaceOrderId: String(receipt.receipt_id),
      marketplaceListingId: receipt.transactions?.[0]?.listing_id != null
        ? String(receipt.transactions[0].listing_id)
        : null,
      buyerUsername: receipt.name,
      salePrice: receipt.grandtotal.amount / receipt.grandtotal.divisor,
      shippingCost: receipt.total_shipping_cost.amount / receipt.total_shipping_cost.divisor,
      marketplaceFees: 0,
      currency: receipt.grandtotal.currency_code,
      shippingAddress: {
        name: receipt.name,
        street1: receipt.first_line,
        street2: receipt.second_line,
        city: receipt.city,
        state: receipt.state,
        zip: receipt.zip,
        country: receipt.country_iso,
      },
    }));
  }

  async searchCategories(query: string): Promise<MarketplaceCategoryResult[]> {
    const nodes = await EtsyAdapter.getTaxonomyNodes();

    const queryLower = query.toLowerCase();
    const matches = nodes
      .filter((cat) => cat.name.toLowerCase().includes(queryLower))
      .slice(0, 20);

    return matches.map((cat) => ({
      id: String(cat.id),
      name: cat.name,
      path: [cat.name],
      isLeaf: true,
    }));
  }

  private static taxonomyCache: Array<{ id: number; name: string }> | null = null;
  private static taxonomyCachedAt = 0;

  private static async getTaxonomyNodes(): Promise<Array<{ id: number; name: string }>> {
    const ONE_HOUR = 60 * 60 * 1000;
    if (EtsyAdapter.taxonomyCache && Date.now() - EtsyAdapter.taxonomyCachedAt < ONE_HOUR) {
      return EtsyAdapter.taxonomyCache;
    }
    const response = await fetch(`${ETSY_BASE}/application/seller-taxonomy/nodes`, {
      headers: { 'x-api-key': env().ETSY_API_KEY! },
    });
    if (!response.ok) throw new Error(`Etsy taxonomy fetch failed: ${response.status}`);
    const data = await response.json() as { results?: Array<{ id: number; name: string }> };
    EtsyAdapter.taxonomyCache = data.results ?? [];
    EtsyAdapter.taxonomyCachedAt = Date.now();
    return EtsyAdapter.taxonomyCache;
  }
}
