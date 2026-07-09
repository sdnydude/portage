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

const marketplaceLabels: Record<string, string> = {
  ebay: "eBay",
  reverb: "Reverb",
};

export function formatMarketplace(marketplace: string): string {
  return marketplaceLabels[marketplace] ?? marketplace;
}
