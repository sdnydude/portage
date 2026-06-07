// Weight/dimension normalization for eBay packageWeightAndSize.
// Items store total ounces + inches; the AI estimator emits mixed units and the
// eBay Inventory API expects { value, unit } objects. Backend-only pure
// converters — the frontend lb+oz split lives in apps/web.

// Keys are lowercased; both short (oz/lb) and eBay/full-word (OUNCE/POUND) forms.
const OUNCES_PER: Record<string, number> = {
  oz: 1,
  ounce: 1,
  lb: 16,
  pound: 16,
  g: 1 / 28.349523125,
  gram: 1 / 28.349523125,
  kg: 35.27396195,
  kilogram: 35.27396195,
};

const INCHES_PER: Record<string, number> = {
  in: 1,
  inch: 1,
  ft: 12,
  feet: 12,
  foot: 12,
  cm: 1 / 2.54,
  centimeter: 1 / 2.54,
  m: 39.37007874,
  meter: 39.37007874,
};

/** Normalize a weight in oz/lb/g/kg (any case) to total ounces. Unknown unit → assume ounces. */
export function toOunces(value: number, unit: string): number {
  return value * (OUNCES_PER[unit.toLowerCase()] ?? 1);
}

/** Normalize a length in in/ft/cm/m (any case) to inches. Unknown unit → assume inches. */
export function toInches(value: number, unit: string): number {
  return value * (INCHES_PER[unit.toLowerCase()] ?? 1);
}

/** Build the eBay Inventory API weight object from total ounces. */
export function toEbayWeight(weightOz: number): { value: number; unit: 'OUNCE' } {
  return { value: weightOz, unit: 'OUNCE' };
}

/** Build the eBay Inventory API dimensions object from inches. */
export function toEbayDimensions(
  lengthIn: number,
  widthIn: number,
  heightIn: number,
): { length: number; width: number; height: number; unit: 'INCH' } {
  return { length: lengthIn, width: widthIn, height: heightIn, unit: 'INCH' };
}
