// SYNC: client-side copy of CONDITION_PREFERENCE_CHAINS in
// apps/api/src/marketplace/ebay-adapter.ts (~:119-125, private — not importable).
// If the adapter chains change, update BOTH. Vocabulary: values are eBay
// conditionIds (Sell metadata), NOT Browse display strings (see mapEbayCondition).
export type PortageCondition = "new" | "like_new" | "good" | "fair" | "poor";

const CONDITION_PREFERENCE_CHAINS: Record<PortageCondition, string[]> = {
  new: ["1000", "1500"],
  like_new: ["2750", "3000", "4000"],
  good: ["5000", "3000", "4000", "6000"],
  fair: ["6000", "3000", "5000"],
  poor: ["6000", "3000", "5000"],
};

export const ALL_PORTAGE_CONDITIONS: PortageCondition[] = [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
];

export function getAvailablePortageConditions(
  conditionIds: string[],
): PortageCondition[] {
  // Fail-open: an empty conditionIds list means the category metadata is
  // unknown/unavailable — offer every Portage condition rather than none.
  if (conditionIds.length === 0) return ALL_PORTAGE_CONDITIONS;
  const available = new Set(conditionIds);
  return ALL_PORTAGE_CONDITIONS.filter((condition) =>
    CONDITION_PREFERENCE_CHAINS[condition].some((id) => available.has(id)),
  );
}
