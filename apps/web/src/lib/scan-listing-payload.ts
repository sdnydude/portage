export interface ScanListingInput {
  itemId: string;
  price: number | null;
  resolvedCategoryId: string | null;
  aspects: Record<string, string[]>;
  /** When true, create an UNPUBLISHED eBay offer (Seller Hub draft) instead of
   *  honoring the profile's draft/live default. */
  ebayDraft?: boolean;
}

export interface SellerProfileLite {
  ebayPublishMode?: "draft" | "live" | null;
}

export interface ScanListingPayload {
  itemId: string;
  marketplace: "ebay";
  price?: number;
  publishMode: "draft" | "live" | "ebay_draft";
  marketplaceSpecificFields?: {
    aspects?: Record<string, string[]>;
    categoryId?: string;
  };
}

export function buildListingPayload(
  input: ScanListingInput,
  profile: SellerProfileLite | null,
): ScanListingPayload {
  // CONSERVATIVE fallback: a missing/failed profile must never cause an
  // accidental live publish — an unexpected draft is recoverable, an
  // unexpected live listing is not.
  // eBay-draft toggle wins; otherwise the conservative profile default applies.
  const publishMode = input.ebayDraft ? "ebay_draft" : (profile?.ebayPublishMode ?? "draft");
  const payload: ScanListingPayload = {
    itemId: input.itemId,
    marketplace: "ebay",
    publishMode,
  };
  if (input.price !== null) payload.price = input.price;
  // Fields attach in BOTH modes: the listings route persists
  // marketplaceSpecificFields on draft rows and the publish route reads them
  // later, so dropping them on draft would re-ask the user at publish for
  // specifics they already confirmed at scan time.
  const fields: NonNullable<ScanListingPayload["marketplaceSpecificFields"]> = {};
  if (input.resolvedCategoryId !== null) fields.categoryId = input.resolvedCategoryId;
  // Drop aspect entries whose value arrays are empty or contain only
  // empty/whitespace strings — eBay rejects blank aspect values.
  const aspects: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(input.aspects)) {
    const kept = values.filter((v) => v.trim() !== "");
    if (kept.length > 0) aspects[name] = kept;
  }
  if (Object.keys(aspects).length > 0) fields.aspects = aspects;
  if (Object.keys(fields).length > 0) payload.marketplaceSpecificFields = fields;
  return payload;
}
