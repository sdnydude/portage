import { describe, it, expect } from 'vitest';
import {
  toOunces,
  toInches,
  toEbayWeight,
  toEbayDimensions,
} from './shipping-units.js';

// Backend weight/dimension normalization for eBay packageWeightAndSize.
// Items store total ounces + inches; the AI estimator feeds mixed units, and
// the eBay Inventory API wants {value, unit} objects.
describe('shipping-units', () => {
  it('normalizes mixed units to ounces/inches and builds eBay-shaped objects', () => {
    // weight → ounces
    expect(toOunces(3.5, 'lb')).toBe(56);
    expect(toOunces(56, 'oz')).toBe(56);
    expect(toOunces(2, 'POUND')).toBe(32);
    expect(toOunces(1000, 'g')).toBeCloseTo(35.274, 2);
    expect(toOunces(1, 'kg')).toBeCloseTo(35.274, 2);

    // dimensions → inches
    expect(toInches(10, 'in')).toBe(10);
    expect(toInches(2.54, 'cm')).toBeCloseTo(1, 5);
    expect(toInches(1, 'ft')).toBe(12);

    // eBay Inventory API shapes
    expect(toEbayWeight(56)).toEqual({ value: 56, unit: 'OUNCE' });
    expect(toEbayDimensions(10, 8, 4)).toEqual({
      length: 10,
      width: 8,
      height: 4,
      unit: 'INCH',
    });
  });
});
