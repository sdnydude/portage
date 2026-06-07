/**
 * Weight conversion helpers for the listing UI.
 *
 * Listing-flow and item state carry weight as decimal POUNDS, but the seller
 * enters it as a lb + oz pair and the item column stores ounces. All conversions
 * round-trip through whole ounces so repeated decompose/compose cycles don't
 * accumulate floating-point drift.
 */

/** Split decimal pounds into whole pounds + remaining ounces for a lb/oz input. */
export function poundsToLbOz(lbs: number | null | undefined): { lb: number; oz: number } {
  if (lbs == null || lbs <= 0) return { lb: 0, oz: 0 };
  const totalOz = Math.round(lbs * 16);
  return { lb: Math.floor(totalOz / 16), oz: totalOz % 16 };
}

/** Combine a lb + oz pair back into decimal pounds; null when the total is zero. */
export function lbOzToPounds(lb: number, oz: number): number | null {
  const totalOz = Math.max(0, lb) * 16 + Math.max(0, oz);
  return totalOz > 0 ? totalOz / 16 : null;
}

interface EbayWeightDims {
  weight: { value: number; unit: string };
  dimensions: { length: number; width: number; height: number; unit: string };
  packageType?: string;
}

/**
 * Convert an eBay-shaped prepare estimate into listing-flow fields: weight to
 * decimal pounds (eBay defaults to ounces), dimensions to inches, package type
 * passed through. Non-positive values become null so the gate/UI treat them as
 * missing rather than zero.
 */
export function ebayEstimateToWeightDims(ebay: EbayWeightDims): {
  weight: number | null;
  dimLength: number | null;
  dimWidth: number | null;
  dimHeight: number | null;
  ebayPackageType: string | null;
} {
  const unit = ebay.weight.unit?.toLowerCase();
  const isOunces = unit === "oz" || unit === "ounce" || unit === "ounces";
  const weightLbs =
    ebay.weight.value > 0 ? (isOunces ? ebay.weight.value / 16 : ebay.weight.value) : null;
  const dim = (n: number) => (n > 0 ? n : null);
  return {
    weight: weightLbs,
    dimLength: dim(ebay.dimensions.length),
    dimWidth: dim(ebay.dimensions.width),
    dimHeight: dim(ebay.dimensions.height),
    ebayPackageType: ebay.packageType || null,
  };
}
