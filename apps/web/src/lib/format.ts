const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function formatCondition(condition: string): string {
  return conditionLabels[condition] ?? condition;
}

export function formatPrice(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "$—";
  return `$${n.toFixed(decimals)}`;
}

// Grouped, currency-aware formatter — integer amounts render clean ($1,200),
// non-integer amounts keep cents ($25.50) instead of silently rounding.
// Formatter instances are cached per currency+precision: they are expensive
// to construct and cards re-render often.
const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(value: number, currency = "USD"): string {
  const wholeDollars = Number.isInteger(value);
  const key = `${currency}:${wholeDollars ? 0 : 2}`;
  let fmt = currencyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: wholeDollars ? 0 : 2,
      maximumFractionDigits: wholeDollars ? 0 : 2,
    });
    currencyFormatters.set(key, fmt);
  }
  return fmt.format(value);
}

const marketplaceLabels: Record<string, string> = {
  ebay: "eBay",
  reverb: "Reverb",
};

export function formatMarketplace(marketplace: string): string {
  return marketplaceLabels[marketplace] ?? marketplace;
}
