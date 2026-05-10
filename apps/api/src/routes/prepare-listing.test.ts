import {
  computePricing,
  conditionNeighbors,
  EBAY_CONDITION_ORDER,
} from './prepare-listing.js';

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

  it('computes suggested as median * 0.97', () => {
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 200, condition: 'GOOD' },
      { price: 300, condition: 'GOOD' },
    ];
    const result = computePricing(comps, 'good', 'USD');
    expect(result.suggested).toBe(Math.round(200 * 0.97 * 100) / 100);
  });

  it('computes low/high as p25/p75', () => {
    const comps = [
      { price: 100, condition: 'GOOD' },
      { price: 200, condition: 'GOOD' },
      { price: 300, condition: 'GOOD' },
      { price: 400, condition: 'GOOD' },
    ];
    const result = computePricing(comps, 'good', 'USD');
    expect(result.low).toBe(200);
    expect(result.high).toBe(300);
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
