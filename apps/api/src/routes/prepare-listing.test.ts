import {
  buildMarketplaceCacheEntries,
  cacheFailWarning,
  computePricing,
  conditionNeighbors,
  reverbCompsWarning,
  sanitizeReverbAiFields,
  EBAY_CONDITION_ORDER,
} from './prepare-listing.js';

describe('sanitizeReverbAiFields', () => {
  // The vision prompt asks the model for Reverb categoryUuid/conditionUuid with
  // no list of valid values — it invents them. Invented UUIDs must never reach
  // the prepare cache: they either 422 at Reverb or fall through to the
  // first-flat-entry guitars guess. Only UUIDs verified against the live lists
  // survive; names resolve to real entries.
  it('replaces hallucinated uuids with entries resolved from the real condition + category lists', () => {
    const ai = {
      make: 'ProCo', model: 'RAT 2', title: 'ProCo RAT 2',
      categoryUuid: 'made-up-cat-uuid', categoryName: 'Effects and Pedals / Distortion',
      conditionUuid: 'made-up-cond-uuid', conditionName: 'Excellent',
      year: null, finish: null, description: 'A pedal',
    };

    const result = sanitizeReverbAiFields(
      ai,
      [{ uuid: 'real-cond-excellent', displayName: 'Excellent' }, { uuid: 'real-cond-good', displayName: 'Good' }],
      [{ id: 'real-cat-distortion', name: 'Effects and Pedals / Distortion' }],
    );

    expect(result).toMatchObject({
      categoryUuid: 'real-cat-distortion',
      categoryName: 'Effects and Pedals / Distortion',
      conditionUuid: 'real-cond-excellent',
      conditionName: 'Excellent',
      make: 'ProCo',
    });
  });
});

describe('buildMarketplaceCacheEntries', () => {
  it('includes a reverb cache entry when the AI produced reverb fields', () => {
    const entries = buildMarketplaceCacheEntries(
      {
        ebay: { categoryId: '33034', categoryName: 'Electric Guitars', title: 'Fender Strat' },
        reverb: {
          categoryUuid: 'rev-cat-1',
          categoryName: 'Solid Body',
          conditionUuid: 'rev-cond-1',
          conditionName: 'Excellent',
          year: '1979',
          finish: 'Sunburst',
        },
      },
      { categoryId: '33034', categoryName: 'Electric Guitars' },
    );

    expect(entries.ebay).toMatchObject({ categoryId: '33034', categoryName: 'Electric Guitars', title: 'Fender Strat' });
    expect(entries.reverb).toMatchObject({
      categoryUuid: 'rev-cat-1',
      categoryName: 'Solid Body',
      conditionUuid: 'rev-cond-1',
      conditionName: 'Excellent',
      year: '1979',
      finish: 'Sunburst',
    });
    expect(typeof entries.reverb!.cachedAt).toBe('string');
  });
});

describe('cacheFailWarning', () => {
  it('names every marketplace whose cache data failed to persist, not just eBay', () => {
    expect(cacheFailWarning({ ebay: {} as never })).toBe(
      'eBay category data could not be saved — re-run prepare before publishing',
    );
    expect(cacheFailWarning({ ebay: {} as never, reverb: {} as never })).toBe(
      'eBay + Reverb category data could not be saved — re-run prepare before publishing',
    );
  });
});

describe('reverbCompsWarning', () => {
  it('warns when the comps result is degraded (API failure) but not when comps are genuinely empty', () => {
    expect(reverbCompsWarning({ listings: [], stats: { median: null, avg: null, sampleSize: 0 }, degraded: true }))
      .toMatch(/comps search failed/i);
    expect(reverbCompsWarning({ listings: [], stats: { median: null, avg: null, sampleSize: 0 } }))
      .toBeUndefined();
  });
});

describe('computePricing', () => {
  it('returns zeros with low confidence for empty comps', () => {
    const result = computePricing([], 'good', 'USD');
    expect(result).toEqual({
      suggested: 0,
      low: 0,
      high: 0,
      currency: 'USD',
      confidence: 'low',
      basedOn: 0,
      conditionMatch: 'all',
      // ONE encoding of "no floor" everywhere — null, never an omitted key
      // (the engine path also returns null; two encodings invite drift).
      bestOfferFloor: null,
    });
  });

  it('uses exact match pool when 3+ comps share condition', () => {
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 120, condition: 'GOOD' },
      { price: 140, condition: 'GOOD' },
      { price: 200, condition: 'NEW' },
    ];
    const result = computePricing(comps, 'good', 'USD');
    expect(result.conditionMatch).toBe('exact');
    expect(result.confidence).toBe('high');
    expect(result.basedOn).toBe(3);
  });

  it('falls back to nearby when <3 exact matches', () => {
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 110, condition: 'GOOD' },
      { price: 120, condition: 'VERY_GOOD' },
      { price: 130, condition: 'ACCEPTABLE' },
    ];
    const result = computePricing(comps, 'good', 'USD');
    expect(result.conditionMatch).toBe('nearby');
    expect(result.confidence).toBe('medium');
  });

  it('falls back to all when <3 nearby matches', () => {
    const comps = [
      { price: 50, condition: 'NEW' },
      { price: 60, condition: 'NEW' },
      { price: 70, condition: 'ACCEPTABLE' },
    ];
    const result = computePricing(comps, 'good', 'EUR');
    expect(result.conditionMatch).toBe('all');
    expect(result.confidence).toBe('low');
    expect(result.currency).toBe('EUR');
    expect(result.basedOn).toBe(3);
  });

  it('reports low confidence AND a null floor on a thin n=2 pool', () => {
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 200, condition: 'GOOD' },
    ];
    const result = computePricing(comps, 'good', 'USD');
    expect(result.confidence).toBe('low');
    expect(result.bestOfferFloor).toBeNull();
  });

  it('computes suggested as median * 0.97', () => {
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 200, condition: 'GOOD' },
      { price: 300, condition: 'GOOD' },
    ];
    const result = computePricing(comps, 'good', 'USD');
    expect(result.suggested).toBe(Math.round(200 * 0.97 * 100) / 100);
  });

  it('computes low/high as R-7 interpolated p25/p75', () => {
    // [100,200,300,400] R-7: p25 idx 0.75 -> 175; p75 idx 2.25 -> 325.
    // (Old index-pluck gave 200/300 with inconsistent floor/ceil — replaced by
    // the shared engine per Stage 2 advisor review.)
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 200, condition: 'GOOD' },
      { price: 300, condition: 'GOOD' },
      { price: 400, condition: 'GOOD' },
    ];
    const result = computePricing(comps, 'good', 'USD');
    expect(result.low).toBe(175);
    expect(result.high).toBe(325);
  });

  it('honors a seller-tuned suggest percentile (no undercut off the default 50)', () => {
    // [100,200,300,400] p75 idx 2.25 -> 325, undercut NOT applied at non-50
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 200, condition: 'GOOD' },
      { price: 300, condition: 'GOOD' },
      { price: 400, condition: 'GOOD' },
    ];
    const result = computePricing(comps, 'good', 'USD', { suggestPercentile: 75 });
    expect(result.suggested).toBe(325);
  });
});

describe('conditionNeighbors', () => {
  it('returns self + adjacent for middle value', () => {
    const result = conditionNeighbors('GOOD');
    expect(result).toEqual(['GOOD', 'VERY_GOOD', 'ACCEPTABLE']);
  });

  it('returns full order for unknown condition', () => {
    const result = conditionNeighbors('UNKNOWN');
    expect(result).toEqual(EBAY_CONDITION_ORDER);
  });
});
