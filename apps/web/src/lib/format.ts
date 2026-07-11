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

// Grouped, currency-aware formatter ($1,200 — unlike formatPrice's ungrouped
// USD-only shorthand). Formatter instances are cached per currency: they are
// expensive to construct and cards re-render often.
const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(value: number, currency = "USD"): string {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, fmt);
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
