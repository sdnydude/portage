import { describe, it, expect } from 'vitest';
import { toEbayWeight, toEbayDimensions } from './shipping-units.js';

// Backend builders for the eBay Inventory API packageWeightAndSize container.
// Items already store normalized total ounces + inches (the frontend does the
// lb+oz / unit conversion for display); the publish merge wraps them here.
describe('shipping-units', () => {
  it('builds the eBay Inventory API weight + dimension shapes', () => {
    expect(toEbayWeight(56)).toEqual({ value: 56, unit: 'OUNCE' });
    expect(toEbayDimensions(10, 8, 4)).toEqual({
      length: 10,
      width: 8,
      height: 4,
      unit: 'INCH',
    });
  });
});
