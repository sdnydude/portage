"use client";

import type { Listing } from "@/hooks/use-listings";
import { marketplaceItemUrl } from "@/lib/marketplace-urls";
import { formatCurrency, formatMarketplace } from "@/lib/format";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  draft: {
    label: "Draft",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  sold: {
    label: "Sold",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

interface ListingCardProps {
  listing: Listing;
  token: string | null;
  onChanged: () => void;
  highlight: boolean;
}

/**
 * Per-listing card on the item detail hub. Read-only in Task 2; Task 3 adds
 * the action surface (price edit, publish, archive, delete, relist).
 * `token`/`onChanged` are part of the stable contract those actions consume.
 */
export function ListingCard({ listing, highlight }: ListingCardProps) {
  const status = statusConfig[listing.status] ?? statusConfig.draft;
  const price = formatCurrency(listing.price, listing.currency || "USD");

  return (
    <div
      className={`bg-surface border border-border rounded-xl p-3 transition-shadow ${
        highlight ? "ring-2 ring-(--teal)" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">
          {formatMarketplace(listing.marketplace)}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-base font-semibold text-text-primary">{price}</span>
        {listing.publishedAt && (
          <span className="text-xs text-text-secondary">
            Listed {new Date(listing.publishedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {listing.marketplaceListingId && (
        <a
          href={marketplaceItemUrl(listing.marketplace, listing.marketplaceListingId)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-(--teal) font-medium"
        >
          View on {formatMarketplace(listing.marketplace)} ↗
        </a>
      )}
    </div>
  );
}
