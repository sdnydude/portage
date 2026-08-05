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
/**
 * Reverb's listing API has no condition-notes/condition-description field
 * (only the main description), so seller condition notes must be folded into
 * the description body or they silently never reach the marketplace.
 */
export function appendConditionNotes(description: string, notes: string | null | undefined): string {
  const trimmed = notes?.trim();
  if (!trimmed) return description;
  return `${description}\n\nCondition notes: ${trimmed}`;
}

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

export interface ReverbFlatCategory {
  uuid: string;
  fullName: string;
  name: string;
  rootUuid: string;
  listable: boolean;
}
let cachedCategories: ReverbFlatCategory[] | null = null;
let categoriesCachedAt = 0;

export function clearReverbCategoriesCache(): void {
  cachedCategories = null;
  categoriesCachedAt = 0;
}

/**
 * Photo-ingestion race guard (live failure 2026-08-04): Reverb ingests the
 * photo URLs from a create ASYNC. A publish retry fired in the same second
 * 422s "must have at least one image" even though the create carried photos.
 * Poll budget: 3 checks, 4s apart — ingestion of a handful of images
 * typically completes well inside that.
 */
export const REVERB_PHOTO_INGEST = { polls: 3, delayMs: 4000 };

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

  /** Enable/update Reverb Bump on a live listing. Bid is a fraction of the
   *  sale price (0.005–0.30 per Reverb's published docs); charged only on sale. */
  async setBump(marketplaceListingId: string, bid: number): Promise<void> {
    if (!(bid >= 0.005 && bid <= 0.30)) {
      // 0.5%-30% per Reverb's published Bump docs (2026-08-05); 3.5% cap was fabricated.
      throw new AppError(400, 'REVERB_BUMP_INVALID', 'Bump bid must be between 0.5% and 30%.');
    }
    await this.request('/bump/v2/bids', {
      method: 'PUT',
      body: JSON.stringify({ products: [Number(marketplaceListingId)], bid }),
    });
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
      // Reverb has no condition-notes field (verified against the create-listings
      // API doc 2026-07-21) — the description is the only place they can live.
      description: appendConditionNotes(input.description, input.conditionNotes),
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
    // Reverb-recommended shipping: reference a Reverb-side shipping profile by
    // id (per-listing rates are discouraged and redundant when a profile wins).
    if (specific.shippingProfileId) {
      body.shipping_profile_id = specific.shippingProfileId;
      // Pickup NEVER shuts off shipping (operator rule 2026-08-05): profile and
      // local:true coexist — live-probe-verified on listing 100019158 (profile
      // rates stay, pickup shows). The old profile-only branch dropped pickup.
      if (specific.localPickup) body.shipping = { local: true };
    } else if (specific.shippingRates) {
      body.shipping = { rates: toReverbShippingRates(specific.shippingRates as unknown[]), local: specific.localPickup ?? false };
    } else if (specific.localPickup) {
      // Local-pickup-only sellers have no rates — Reverb accepts local:true
      // alone, and publish requires one or the other.
      body.shipping = { local: true };
    }
    // Reverb blocks publish on Brand New items without a UPC ("A valid UPC/EAN
    // must be entered in the UPC field or the 'UPC does not apply' field must
    // be marked true for a Brand New item"). Send a real UPC when the caller
    // has one; otherwise flag does-not-apply for new-condition items.
    if (specific.upc) {
      body.upc = specific.upc;
    } else if (input.condition === 'new') {
      body.upc_does_not_apply = 'true';
    }

    const data = await this.request<{ listing: { id: number; state: string; _links?: { web?: { href?: string } } } }>(
      '/listings',
      { method: 'POST', body: JSON.stringify(body) },
    );

    logger.info({ listingId: data.listing.id }, 'Reverb listing created');

    let createdSlug = stateSlug(data.listing.state);
    let stateWarning: string | undefined;
    // Live-verified 2026-07-21: a POST whose publish:"true" fails Reverb's
    // publish validation still returns 201 state=draft with NO error — the
    // listing parks in Reverb drafts silently and never goes live on its own.
    // A follow-up PUT publish either completes the publish or 422s with the
    // exact blockers (e.g. "Please set a shipping rate or enable local
    // pickup.") — surface those verbatim so the seller can act.
    if (createdSlug !== 'live') {
      // Photo-ingestion race guard: wait until Reverb reports at least one
      // ingested photo before retrying publish — otherwise the retry 422s
      // on the image requirement while ingestion is still running.
      if (input.photos.length > 0) {
        for (let attempt = 0; attempt < REVERB_PHOTO_INGEST.polls; attempt++) {
          try {
            const check = await this.request<{ listing?: { photos?: unknown[] } }>(`/listings/${data.listing.id}`, { method: 'GET' });
            if ((check.listing?.photos?.length ?? 0) > 0) break;
          } catch {
            break; // best-effort — the publish retry below surfaces real blockers
          }
          if (attempt < REVERB_PHOTO_INGEST.polls - 1 || REVERB_PHOTO_INGEST.polls === 1) {
            await new Promise((r) => setTimeout(r, REVERB_PHOTO_INGEST.delayMs));
          }
        }
      }
      try {
        const retry = await this.request<{ listing?: { state?: string | { slug?: string } } }>(
          `/listings/${data.listing.id}`,
          { method: 'PUT', body: JSON.stringify({ publish: 'true' }) },
        );
        createdSlug = stateSlug(retry.listing?.state) ?? createdSlug;
        if (createdSlug !== 'live') {
          stateWarning = `Reverb saved the listing as a draft (state: ${createdSlug ?? 'unknown'}). Publish it from your Reverb drafts once the shop requirements are met.`;
        }
      } catch (err) {
        const reason = err instanceof AppError ? err.message : 'Reverb did not report a reason';
        stateWarning = `Reverb saved the listing as a draft — it cannot go live yet. Reverb reports: ${reason}`;
      }
    }

    return {
      marketplaceListingId: String(data.listing.id),
      // _links can be absent on shape drift / review-pending responses — never
      // crash a successful publish over the URL.
      marketplaceUrl: data.listing._links?.web?.href ?? `https://reverb.com/item/${data.listing.id}`,
      status: createdSlug === 'live' ? 'active' : 'draft',
      warning: [conditionWarning, stateWarning].filter(Boolean).join('; ') || undefined,
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    const specific = input.marketplaceSpecific ?? {};
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.description) updates.description = appendConditionNotes(input.description, input.conditionNotes);
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
    // Re-publish path for a remote draft that already exists on Reverb (a
    // Portage draft row WITH a marketplaceListingId): PUT publish on the
    // existing listing — creating again would double-list. Publishing has the
    // same UPC requirement as create for Brand New items.
    if (specific.publish) {
      updates.publish = 'true';
      if (specific.upc) {
        updates.upc = specific.upc;
      } else if (input.condition === 'new') {
        updates.upc_does_not_apply = 'true';
      }
    }
    if (specific.categoryUuid) updates.categories = [{ uuid: specific.categoryUuid }];
    if (specific.year) updates.year = specific.year;
    if (specific.finish) updates.finish = specific.finish;
    if (specific.offersEnabled !== undefined) updates.offers_enabled = specific.offersEnabled;
    if (specific.shippingProfileId) {
      // Same precedence as create: a Reverb-side shipping profile id wins over
      // per-listing rates. Pickup never shuts off shipping (operator rule
      // 2026-08-05): local:true rides alongside the profile — same as create.
      updates.shipping_profile_id = specific.shippingProfileId;
      if (specific.localPickup) updates.shipping = { local: true };
    } else if (specific.shippingRates) {
      updates.shipping = { rates: toReverbShippingRates(specific.shippingRates as unknown[]), local: specific.localPickup ?? false };
    } else if (specific.localPickup) {
      // Pickup-only parity with create: no profile, no rates — local:true alone.
      updates.shipping = { local: true };
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
    // DELETE only works on drafts ("Only drafts can be deleted", live-verified
    // 2026-07-21) — a live listing must be ENDED via the state/end call
    // (PUT /my/listings/:id/state/end, reason not_sold). Try the draft delete
    // first, fall back to ending.
    try {
      await this.request(`/listings/${marketplaceListingId}`, { method: 'DELETE' });
    } catch (err) {
      if (!(err instanceof AppError) || err.statusCode !== 400) throw err;
      await this.request(`/my/listings/${marketplaceListingId}/state/end`, {
        method: 'PUT',
        body: JSON.stringify({ reason: 'not_sold' }),
      });
    }
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

  /**
   * Shipping profiles are created manually ON Reverb
   * (reverb.com/my/selling/shipping_rates — no create/update API) and
   * referenced per listing via shipping_profile_id. GET /shop lists them.
   */
  async getShippingProfiles(): Promise<Array<{ id: string; name: string }>> {
    const data = await this.request<{
      shipping_profiles?: Array<{ id: string | number; name: string }>;
    }>('/shop');
    return (data.shipping_profiles ?? []).map(p => ({ id: String(p.id), name: p.name }));
  }

  async searchCategories(query: string): Promise<MarketplaceCategoryResult[]> {
    // Live-verified 2026-07-21: /categories/flat IGNORES ?query= and always
    // returns the same full list (first entry "Acoustic Guitars / 12-String"),
    // so matching MUST happen client-side — passing the query through meant
    // every caller took the first flat entry and mis-categorized as guitars.
    const categories = await ReverbAdapter.getFlatCategories();

    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3);
    // Majority rule: a lone token hit out of several is noise ("Solid State
    // Drives" matching "Electric Guitars / Solid Body" on "solid" — live repro
    // 2026-07-21). Non-matches fall through to the route's 422 guidance.
    const minScore = Math.ceil(tokens.length / 2);
    return categories
      .map(cat => ({
        cat,
        score: tokens.filter(t => cat.fullName.toLowerCase().includes(t)).length,
      }))
      .filter(({ score }) => score >= Math.max(minScore, 1))
      // Most matched tokens first; ties break to the shortest full_name so a
      // single-token match lands the general category, not a random deep leaf.
      .sort((a, b) => b.score - a.score || a.cat.fullName.length - b.cat.fullName.length)
      .slice(0, 25)
      .map(({ cat }) => ({
        id: cat.uuid,
        name: cat.fullName,
        // Leaf-safe path: strip the API's own leaf name, split only the ancestor
      // prefix (leaf names may themselves contain " / ").
      path: [
        ...cat.fullName.slice(0, cat.fullName.length - cat.name.length).replace(/ \/ $/, '').split(' / ').filter(Boolean),
        cat.name,
      ],
        isLeaf: true,
      }));
  }

  /**
   * Reverb's flat category list — static reference data on a PUBLIC endpoint
   * (no auth), cached like getConditions. This is the ONLY valid source of
   * category uuids/names; the endpoint's ?query= param is ignored by Reverb,
   * so all matching against this list happens client-side.
   */
  static async getFlatCategories(): Promise<ReverbFlatCategory[]> {
    if (cachedCategories && Date.now() - categoriesCachedAt < CONDITIONS_TTL) return cachedCategories;

    const response = await fetch(`${REVERB_BASE}/categories/flat`, {
      headers: { 'Accept': 'application/hal+json', 'Accept-Version': '3.0' },
    });

    if (!response.ok) {
      throw new AppError(response.status, 'REVERB_API_ERROR', `Failed to fetch Reverb categories: ${response.status}`);
    }

    const data = await response.json() as {
      categories: Array<{ uuid: string; full_name: string; name?: string; root_uuid?: string; listable?: boolean }>;
    };

    // Keep the hierarchy fields — Product Type → subcategory cascades need
    // name/rootUuid/listable, and leaf names can legitimately contain " / "
    // ("Modular Synth Splitters / Hubs"), so `name` is the ONLY safe way to
    // split full_name into ancestors + leaf.
    cachedCategories = data.categories.map(c => ({
      uuid: c.uuid,
      fullName: c.full_name,
      name: c.name ?? c.full_name.split(' / ').pop() ?? c.full_name,
      rootUuid: c.root_uuid ?? '',
      listable: c.listable ?? true,
    }));
    categoriesCachedAt = Date.now();

    return cachedCategories;
  }

  /** The 14 taxonomy roots — Reverb's Product Type axis. Root entries are the
   *  flat rows whose fullName equals their own name. */
  static async getProductTypes(): Promise<ReverbFlatCategory[]> {
    const cats = await ReverbAdapter.getFlatCategories();
    return cats.filter(c => c.fullName === c.name);
  }

  /** Direct children of a taxonomy node. Parent/child derived by prefix:
   *  child.fullName === parent.fullName + ' / ' + child.name — anchored on the
   *  API's own `name` field because leaf names can contain " / " themselves. */
  static async getCategoryChildren(parentUuid: string): Promise<ReverbFlatCategory[]> {
    const cats = await ReverbAdapter.getFlatCategories();
    const parent = cats.find(c => c.uuid === parentUuid);
    if (!parent) return [];
    return cats.filter(c => c.uuid !== parent.uuid && c.fullName === `${parent.fullName} / ${c.name}`);
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
