/**
 * Shared pricing engine — percentile bands from a single comp pool.
 *
 * Money math contract (engineering-advisor review, Stage 2):
 * - R-7 linear interpolation for percentiles (consistent, unlike index-pluck).
 * - All band values derive from the SAME pool in ONE call — never mix a
 *   condition-filtered pool with the raw pool for floor vs suggested.
 * - Round ONCE at the end: Math.round((x + Number.EPSILON) * 100) / 100.
 * - Float dollars throughout (codebase-consistent; do not half-convert to cents).
 */

/** Undercut applied to the suggested price ONLY at the default percentile 50. */
export const SUGGEST_UNDERCUT = 0.97;

export interface PriceBandsOptions {
  /** Percentile for the suggested price. Default 50. */
  suggestPercentile?: number;
  /** Percentile for the Best-Offer auto-accept floor. Default 25. */
  floorPercentile?: number;
}

export interface PriceBands {
  p25: number;
  p50: number;
  p75: number;
  suggested: number;
  /** null when the pool is too small (n<3) or the floor would invert (floor >= suggested). */
  floor: number | null;
  basedOn: number;
}

const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

const clampPercentile = (p: number): number => Math.min(95, Math.max(5, p));

/** R-7 linear interpolation over an ascending-sorted array. */
function percentileR7(sorted: number[], p: number): number {
  const idx = ((sorted.length - 1) * p) / 100;
  const lo = Math.floor(idx);
  const frac = idx - lo;
  return sorted[lo] + frac * ((sorted[lo + 1] ?? sorted[lo]) - sorted[lo]);
}

/**
 * Compute percentile price bands from one pool of sold-comp prices.
 * Returns null when the pool is empty (callers render "no data", never $0).
 * Confidence semantics live with the caller (condition-match aware); the
 * engine's only size rule is floor suppression below n=3.
 */
export function computePriceBands(
  prices: number[],
  opts: PriceBandsOptions = {},
): PriceBands | null {
  const n = prices.length;
  if (n === 0) return null;

  const sorted = [...prices].sort((a, b) => a - b);
  const suggestP = clampPercentile(opts.suggestPercentile ?? 50);
  const floorP = clampPercentile(opts.floorPercentile ?? 25);

  const rawSuggested = percentileR7(sorted, suggestP);
  const suggested = round2(suggestP === 50 ? rawSuggested * SUGGEST_UNDERCUT : rawSuggested);

  let floor: number | null = null;
  if (n >= 3) {
    const rawFloor = round2(percentileR7(sorted, floorP));
    floor = rawFloor >= suggested ? null : rawFloor;
  }

  return {
    p25: round2(percentileR7(sorted, 25)),
    p50: round2(percentileR7(sorted, 50)),
    p75: round2(percentileR7(sorted, 75)),
    suggested,
    floor,
    basedOn: n,
  };
}
