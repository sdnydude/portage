/**
 * Best Offer pre-flight validation (BO-3). eBay requires both thresholds
 * strictly below the Buy It Now price (codes 22003 auto-decline, 23004
 * auto-accept — observed live 2026-08-03). Validating here, before any DB
 * save or eBay call, is what lets a conflict surface with the numbers
 * instead of blocking the edit or (the old bug) deleting seller config.
 */

export interface BestOfferSpecific {
  bestOfferAutoAcceptPrice?: number;
  minimumBestOfferPrice?: number;
}

export type BestOfferValidation = { ok: true } | { ok: false; message: string };

export function validateBestOfferThresholds(price: number, specific: BestOfferSpecific): BestOfferValidation {
  // Both bounds matter (CodeRabbit): a threshold at/above price fails on
  // eBay (22003/23004), and a 0/negative one would pass here only to be
  // silently dropped by the XML builder — the phantom-config class again.
  const accept = specific.bestOfferAutoAcceptPrice;
  if (typeof accept === 'number' && (accept >= price || accept <= 0)) {
    return {
      ok: false,
      message: `The Best Offer auto-accept price $${accept} must be a positive amount below the listing price $${price} — adjust the offer thresholds together with the price.`,
    };
  }
  const min = specific.minimumBestOfferPrice;
  if (typeof min === 'number' && (min >= price || min <= 0)) {
    return {
      ok: false,
      message: `The Best Offer minimum price $${min} must be a positive amount below the listing price $${price} — adjust the offer thresholds together with the price.`,
    };
  }
  // eBay 23005: auto-accept must sit strictly above auto-decline (minimum).
  // Equal or swapped values pass the per-bound checks above but die at eBay
  // ("Auto Accept price must be higher than Auto Decline price" — observed
  // live 2026-08-04, accept $135 under minimum $144).
  if (typeof accept === 'number' && typeof min === 'number' && accept <= min) {
    return {
      ok: false,
      message: `The Best Offer auto-accept price $${accept} must be higher than the minimum offer $${min} — swap or adjust the two amounts.`,
    };
  }
  return { ok: true };
}

/** Minimal adapter surface the heal needs — avoids importing the full EbayAdapter. */
interface BestOfferReadBack {
  getEbayItemVerification(itemId: string): Promise<{
    found: boolean;
    bestOfferEnabled: boolean | null;
    bestOfferAutoAcceptPrice: number | null;
    minimumBestOfferPrice: number | null;
  }>;
}

/**
 * Conflict-time heal (BO-3): eBay owns live Best Offer truth — read it back
 * and adopt it over the stored copy. One GetItem, called only on the
 * conflict path; sibling keys in the stored specifics are untouched. Fields
 * absent on the live listing are REMOVED locally (drift where eBay was
 * stripped), never invented.
 */
export async function healBestOfferFromLive(
  adapter: BestOfferReadBack,
  marketplaceListingId: string,
  specific: Record<string, unknown>,
): Promise<{ specific: Record<string, unknown>; healed: boolean }> {
  const live = await adapter.getEbayItemVerification(marketplaceListingId);
  if (!live.found) return { specific, healed: false };
  // Guard (audit #2): the GetItem BestOfferDetails parse shape is not yet
  // live-verified. Deleting local keys is only allowed when the live Best
  // Offer block POSITIVELY parsed (enabled flag present) — a parse miss must
  // never be read as "eBay has no Best Offer" and strip seller config.
  if (live.bestOfferEnabled == null) return { specific, healed: false };

  const healed: Record<string, unknown> = { ...specific };
  const apply = (key: 'bestOfferEnabled' | 'bestOfferAutoAcceptPrice' | 'minimumBestOfferPrice', value: boolean | number | null) => {
    if (value == null) delete healed[key];
    else healed[key] = value;
  };
  apply('bestOfferEnabled', live.bestOfferEnabled);
  apply('bestOfferAutoAcceptPrice', live.bestOfferAutoAcceptPrice);
  apply('minimumBestOfferPrice', live.minimumBestOfferPrice);

  const changed = ['bestOfferEnabled', 'bestOfferAutoAcceptPrice', 'minimumBestOfferPrice']
    .some((k) => healed[k] !== (specific as Record<string, unknown>)[k]);
  return { specific: healed, healed: changed };
}
