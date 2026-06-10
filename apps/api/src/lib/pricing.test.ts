import { describe, it, expect } from 'vitest';
import { computePriceBands } from './pricing.js';

describe('computePriceBands', () => {
  it('computes R-7 interpolated bands, undercut suggested, and floor from one pool', () => {
    // sorted pool [10, 20, 30, 40], n=4 — R-7: idx = (n-1) * p / 100
    // p25: idx 0.75 -> 10 + 0.75*(20-10) = 17.5
    // p50: idx 1.5  -> 20 + 0.5*(30-20)  = 25
    // p75: idx 2.25 -> 30 + 0.25*(40-30) = 32.5
    // suggested: default percentile 50 -> 25 * 0.97 = 24.25 (undercut applies at 50 only)
    // floor: default percentile 25 -> 17.5 (< suggested, so kept)
    const bands = computePriceBands([20, 40, 10, 30]);

    expect(bands).toEqual({
      p25: 17.5,
      p50: 25,
      p75: 32.5,
      suggested: 24.25,
      floor: 17.5,
      basedOn: 4,
    });
  });

  it('returns null for an empty pool (no $0 bands)', () => {
    expect(computePriceBands([])).toBeNull();
  });

  it('suppresses the floor when n < 3', () => {
    const bands = computePriceBands([10, 30]);
    expect(bands?.basedOn).toBe(2);
    expect(bands?.floor).toBeNull();
    expect(bands?.suggested).toBeGreaterThan(0);
  });

  it('does NOT undercut when suggestPercentile is overridden away from 50', () => {
    // [10,20,30,40] p60: idx 1.8 -> 20 + 0.8*10 = 28 — no 0.97 factor
    const bands = computePriceBands([10, 20, 30, 40], { suggestPercentile: 60 });
    expect(bands?.suggested).toBe(28);
  });

  it('nulls the floor when it would invert (floor >= suggested)', () => {
    // suggest p25 -> 17.5 (no undercut), floor p75 -> 32.5 >= 17.5 -> null
    const bands = computePriceBands([10, 20, 30, 40], { suggestPercentile: 25, floorPercentile: 75 });
    expect(bands?.suggested).toBe(17.5);
    expect(bands?.floor).toBeNull();
  });

  it('clamps percentiles to 5–95', () => {
    // p99 requested -> clamped to 95: idx 2.85 -> 30 + 0.85*10 = 38.5
    const bands = computePriceBands([10, 20, 30, 40], { suggestPercentile: 99 });
    expect(bands?.suggested).toBe(38.5);
  });

  it('rounds once at the end with the EPSILON guard', () => {
    // n=1: every percentile = 1.005, which is 100.49999... cents without EPSILON.
    // Bands must round to 1.01; suggested = 1.005 * 0.97 = 0.97485 -> 0.97.
    const bands = computePriceBands([1.005]);
    expect(bands?.p50).toBe(1.01);
    expect(bands?.suggested).toBe(0.97);
  });
});
