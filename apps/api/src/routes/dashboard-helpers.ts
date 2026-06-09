/** Row shape selected for the dashboard "recent listings" query. */
export interface RecentListingRow {
  id: string;
  itemId: string;
  marketplace: string;
  status: string;
  price: number;
  currency: string;
  createdAt: Date | string;
  publishedAt: Date | string | null;
  itemTitle: string;
  itemPhoto: unknown;
  aiConfidence: number | null;
}

export function mapRecentListing(row: RecentListingRow) {
  const photos =
    (row.itemPhoto as Array<{ url: string; isPrimary?: boolean }> | null) ?? [];
  const primaryPhoto = photos.find((p) => p.isPrimary) ?? photos[0];
  return {
    id: row.id,
    itemId: row.itemId,
    marketplace: row.marketplace,
    status: row.status,
    price: row.price,
    currency: row.currency,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    itemTitle: row.itemTitle,
    itemPhotoUrl: primaryPhoto?.url ?? null,
    confidence: row.aiConfidence ?? 0,
  };
}
