/**
 * Public marketplace item-page URL for a published listing. Extracted from
 * listings/[id]/page.tsx (marketplaceBaseUrls) so the ListingCard hub and the
 * legacy page build identical links.
 */
export function marketplaceItemUrl(
  marketplace: "ebay" | "reverb",
  marketplaceListingId: string,
): string {
  return marketplace === "ebay"
    ? `https://www.ebay.com/itm/${marketplaceListingId}`
    : `https://reverb.com/item/${marketplaceListingId}`;
}
