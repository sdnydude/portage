/**
 * Append a seller's default listing footer to a description at publish time.
 * Server-side so every marketplace path gets it without bulk-rewriting stored
 * descriptions — footer edits propagate on the next create/update.
 */
/**
 * Description ceiling used by the footer length guard, per marketplace.
 * eBay's 500000 is the documented HTML description limit; the others are
 * deliberately conservative defaults, far above any real Portage description.
 */
export function descriptionLimitFor(marketplace: string): number {
  return marketplace === 'ebay' ? 500000 : 50000;
}

export function applyFooter(description: string, footer: string | null | undefined, maxLength: number): string {
  const trimmed = footer?.trim();
  if (!trimmed) return description;
  // Idempotent: updates re-apply over an already-footered description.
  if (description.endsWith(trimmed)) return description;
  const combined = `${description}\n\n${trimmed}`;
  // Over the marketplace limit: drop the footer, never truncate seller content.
  if (combined.length > maxLength) return description;
  return combined;
}
