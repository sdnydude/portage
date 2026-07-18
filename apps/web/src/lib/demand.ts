/**
 * Sell-through → demand label. ONE home for the business rule both pricing
 * widgets render (comps-pricing-widget + scan-flow review): Hot when at
 * least 2/3 of comps sold, Slow when under 1/3, Normal between. null in →
 * null out (no badge when there's no data).
 */
export function demandLabel(sellThrough: number | null | undefined): "Hot" | "Normal" | "Slow" | null {
  if (sellThrough == null) return null;
  if (sellThrough >= 2 / 3) return "Hot";
  if (sellThrough < 1 / 3) return "Slow";
  return "Normal";
}
