// Builders for the eBay Inventory API packageWeightAndSize container.
// Items store normalized total ounces + inches (the frontend handles lb+oz and
// unit conversion for display); the publish merge wraps the stored values here.
// Backend-only.

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
