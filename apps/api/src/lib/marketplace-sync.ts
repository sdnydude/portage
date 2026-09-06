import { createLogger } from './logger.js';
import { EbayAdapter, resolveEbayCategoryId } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { mergeItemShipping, mergeItemAspects, applyShipFromOrigin, applyReverbEnrichment } from '../routes/listings.js';
import { validateBestOfferThresholds, healBestOfferFromLive } from './best-offer.js';
import { AppError } from '../middleware/error.js';
import { db } from '../db/index.js';
import { sellerProfiles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { applyFooter, descriptionLimitFor } from './footer.js';

const logger = createLogger('marketplace-sync');

/**
 * Publish parity: the publish routes append the seller's default listing
 * footer to the description (listings.ts applyFooter); edit-sync used to send
 * the raw item description, so any item edit silently stripped the footer
 * from the live listing (Epson 5050UB, 2026-09-06). Best-effort read — a
 * failed lookup syncs without the footer rather than blocking the edit.
 */
async function loadListingFooter(userId: string): Promise<string | null> {
  try {
    const [row] = await db.select({ footer: sellerProfiles.defaultListingFooter })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);
    return row?.footer ?? null;
  } catch (err) {
    logger.warn({ userId, error: (err as Error).message }, 'Listing footer lookup failed — syncing description without it');
    return null;
  }
}

/** The listings-row slice the executor needs — matches the items.ts edit-sync select. */
export interface ItemSyncTarget {
  id: string;
  marketplace: 'ebay' | 'etsy' | 'reverb';
  status: string;
  marketplaceListingId: string | null;
  ebaySku: string | null;
  marketplaceSpecificFields: unknown;
  currency: string;
}

/** The items-row slice the executor reads. Structural — pass the full Drizzle row. */
export interface ItemSyncSource {
  id: string;
  title: string;
  description: string;
  category: string | null;
  condition: string;
  conditionNotes?: string | null;
  brand: string | null;
  model: string | null;
  price: number | null;
  quantity: number;
  photos: unknown;
  features: unknown;
  aspects?: unknown;
  marketplaceData: unknown;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  ebayPackageType: string | null;
}

/**
 * Push an item's current fields to ONE marketplace listing row (extracted from
 * the items.ts PATCH loop for the P2 outbox worker — route and worker share
 * this executor). Throws on adapter failure; the caller decides warning vs
 * retry semantics. Returns non-fatal warnings (adapter degradations,
 * enrichment guesses).
 */
export async function syncItemListingRow(
  userId: string,
  item: ItemSyncSource,
  listed: ItemSyncTarget,
  opts: { includePhotos: boolean },
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  const syncId = listed.marketplaceListingId;
  if (!syncId) return { warnings };

  // Parked marketplace (etsy enum value is inert but a stray row types as
  // 'etsy') — never fall through to another adapter (CodeRabbit PR #283).
  if (listed.marketplace !== 'ebay' && listed.marketplace !== 'reverb') {
    warnings.push(`${listed.marketplace}: sync not supported in this release`);
    return { warnings };
  }

  if (listed.marketplace === 'ebay') {
    // GetItem-imported rows carry EMPTY specifics — without a leaf categoryId,
    // ReviseFixedPriceItem rejects every edit-sync. Reuse the publish path's
    // self-heal (listing intent → item cache → Taxonomy suggestion).
    const specifics = listed.marketplaceSpecificFields as Record<string, unknown> | undefined;
    let healed = { ...(specifics ?? {}) };
    if (!healed.categoryId || healed.categoryId === '99') {
      const cat = await resolveEbayCategoryId(healed, item);
      if (cat.categoryId) healed.categoryId = cat.categoryId;
    }
    // Publish parity: inline calculated shipping needs the seller's ship-from ZIP.
    healed = (await applyShipFromOrigin(userId, healed)) as Record<string, unknown>;
    const adapter = new EbayAdapter(userId);
    // BO-3 pre-flight (parity with the listings PATCH route): an item-edit
    // price change syncs with the STORED thresholds — a stale/conflicting
    // pair reached eBay raw here (observed live 2026-08-04, price $149 vs
    // stored $240/$220 → 22003). Heal from the live listing on conflict;
    // still conflicting → typed 422 the worker terminal-fails on.
    if (typeof item.price === 'number') {
      let boCheck = validateBestOfferThresholds(item.price, healed);
      if (!boCheck.ok) {
        const healResult = await healBestOfferFromLive(adapter, syncId, healed);
        if (healResult.healed) {
          healed = healResult.specific;
          warnings.push('ebay: Best Offer settings were out of date and refreshed from your live eBay listing.');
        }
        boCheck = validateBestOfferThresholds(item.price, healed);
        if (!boCheck.ok) throw new AppError(422, 'BEST_OFFER_CONFLICT', boCheck.message);
      }
    }
    const footer = await loadListingFooter(userId);
    const syncResult = await adapter.updateListing(syncId, {
      title: item.title,
      description: applyFooter(item.description, footer, descriptionLimitFor('ebay')),
      price: item.price ?? undefined,
      currency: listed.currency,
      condition: item.condition,
      conditionNotes: item.conditionNotes ?? undefined,
      quantity: item.quantity,
      brand: item.brand ?? undefined,
      model: item.model ?? undefined,
      // eBay's full-body revise needs the current photos inline — one XML
      // call, no per-photo cost, so no photo diff on this branch.
      photos: (item.photos as Array<{ url: string; isPrimary?: boolean }>) ?? [],
      features: item.features as string[],
      ebaySku: listed.ebaySku ?? undefined,
      // eBay-Trading-specific merges — never applied to Reverb.
      marketplaceSpecific: mergeItemAspects(item as { aspects?: Record<string, string[]> | null }, mergeItemShipping(item, healed)),
    });
    if (syncResult.warning) warnings.push(`ebay: ${syncResult.warning}`);
  } else {
    const adapter = new ReverbAdapter(userId);
    // Enrichment parity with the listings.ts sync path: the LIVE profile owns
    // offersEnabled and shipping defaults. Best-effort — Reverb's PUT is
    // partial, so a failed enrichment must not block syncing the edit itself.
    let reverbSpecific = listed.marketplaceSpecificFields as Record<string, unknown> | undefined;
    try {
      const enriched = await applyReverbEnrichment(userId, item as Parameters<typeof applyReverbEnrichment>[1], adapter, reverbSpecific);
      reverbSpecific = enriched.specific;
      if (enriched.warning) warnings.push(`reverb: ${enriched.warning}`);
    } catch (enrichErr) {
      logger.warn({ itemId: item.id, syncId, error: (enrichErr as Error).message }, 'Reverb enrichment failed on item-edit sync — syncing with stored specifics');
      // Audit M9: without this, seller-profile drift (offers/shipping
      // defaults) fails to propagate with zero signal anywhere.
      warnings.push('reverb: seller-profile enrichment failed — synced with stored settings, offers/shipping defaults may be stale');
    }
    const footer = await loadListingFooter(userId);
    const syncResult = await adapter.updateListing(syncId, {
      title: item.title,
      description: applyFooter(item.description, footer, descriptionLimitFor('reverb')),
      price: item.price ?? undefined,
      currency: listed.currency,
      condition: item.condition,
      // Reverb appends condition notes to the description at the adapter —
      // without this an item's condition-note edit never reaches the listing.
      conditionNotes: item.conditionNotes ?? undefined,
      quantity: item.quantity,
      brand: item.brand ?? undefined,
      model: item.model ?? undefined,
      // Photo diff: Reverb photo updates cost a PUT + GET /images + one
      // DELETE per removed photo, so only send photos when the triggering
      // edit changed them — omitted photos leave the live set alone.
      photos: opts.includePhotos ? ((item.photos as Array<{ url: string; isPrimary?: boolean }>) ?? []) : undefined,
      marketplaceSpecific: reverbSpecific,
    });
    if (syncResult.warning) warnings.push(`reverb: ${syncResult.warning}`);
  }
  return { warnings };
}
