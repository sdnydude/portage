/** Item fields used to resolve a publish price (null-tolerant — matches the web Item). */
export interface PublishPriceItem {
  price?: number | null;
  estimatedValueRecommended?: number | null;
  estimatedValueMin?: number | null;
}

/**
 * Parse a price text input into a valid sale price, or null. Empty, non-numeric,
 * zero, and negative inputs all resolve to null (the "unset" sentinel) — eBay
 * disallows $0 listings, matching the server's min(0.01) floor.
 */
export function parsePriceInput(raw: string): number | null {
  const n = parseFloat(raw);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

/** Comp price stats, as returned by the comps endpoint (subset we use here). */
export interface PublishPriceComps {
  soldMedian?: number | null;
  activeMedian?: number | null;
}

/**
 * Resolve the price to prefill the editable price field shown on every eBay
 * publish. Precedence: the seller's explicit price wins; otherwise fall back to
 * market comps, then the AI estimate. Returns null when nothing is known (the
 * publish UI then requires the seller to enter one).
 *
 * Uses `??` deliberately: the "unset" sentinel is null/undefined, NOT 0. A real
 * stored price is always ≥ 0.01 (enforced server-side), so 0 never appears here;
 * `??` correctly stops at the first defined value without skipping a legitimate 0.
 */
export function resolvePublishPrice(
  item: PublishPriceItem,
  comps?: PublishPriceComps | null,
): number | null {
  return (
    item.price ??
    comps?.soldMedian ??
    comps?.activeMedian ??
    item.estimatedValueRecommended ??
    item.estimatedValueMin ??
    null
  );
}
