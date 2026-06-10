// Seller listing footers, appended at publish time. Server-side so every
// marketplace path gets the footer without bulk-rewriting stored descriptions
// — footer edits propagate on the next create/update.

/**
 * Description ceiling used by the footer length guard, per marketplace.
 * eBay's 500000 is the documented HTML description limit; the others are
 * deliberately conservative defaults, far above any real Portage description.
 */
export function descriptionLimitFor(marketplace: string): number {
  return marketplace === 'ebay' ? 500000 : 50000;
}

/**
 * Append the seller's default footer to a description. Idempotent (re-applying
 * over an already-footered description is a no-op) and drop-not-truncate:
 * over the marketplace limit the FOOTER is dropped, never seller content.
 */
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
