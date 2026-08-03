import { createLogger } from './logger.js';
import { EbayAdapter, resolveEbayCategoryId } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { mergeItemShipping, mergeItemAspects, applyShipFromOrigin, applyReverbEnrichment } from '../routes/listings.js';

const logger = createLogger('marketplace-sync');

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
    const syncResult = await adapter.updateListing(syncId, {
      title: item.title,
      description: item.description,
      price: item.price ?? undefined,
      currency: listed.currency,
      condition: item.condition,
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
    }
    const syncResult = await adapter.updateListing(syncId, {
      title: item.title,
      description: item.description,
      price: item.price ?? undefined,
      currency: listed.currency,
      condition: item.condition,
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
