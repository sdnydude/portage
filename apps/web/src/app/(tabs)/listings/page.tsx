"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useListings } from "@/hooks/use-listings";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import type { Listing } from "@/hooks/use-listings";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  sold: "Sold",
  archived: "Archived",
};

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  sold: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const marketplaceIcons: Record<string, string> = {
  ebay: "eBay",
  etsy: "Etsy",
};

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border hover:border-border-focus transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[listing.status]}`}>
            {statusLabels[listing.status]}
          </span>
          <span className="text-[10px] font-medium text-text-secondary uppercase">
            {marketplaceIcons[listing.marketplace]}
          </span>
        </div>
        <div className="text-sm font-medium text-text-primary">
          ${listing.price.toFixed(2)} {listing.currency}
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          {listing.publishedAt
            ? `Published ${new Date(listing.publishedAt).toLocaleDateString()}`
            : `Created ${new Date(listing.createdAt).toLocaleDateString()}`}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-placeholder flex-shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export default function ListingsPage() {
  const { isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const { listings, isLoading, error } = useListings({ status: statusFilter || undefined });

  const statusFilters = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "draft", label: "Drafts" },
    { value: "sold", label: "Sold" },
  ];

  if (!isAuthenticated) {
    return (
      <>
        <PageHeader title="Listings" subtitle="Your marketplace listings" />
        <div className="px-4 py-6 max-w-lg mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-text-secondary">Sign in to manage your listings.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Listings" subtitle={listings.length > 0 ? `${listings.length} listing${listings.length !== 1 ? "s" : ""}` : undefined} />
      <div className="px-4 py-3 max-w-lg mx-auto space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? "bg-forest-green text-white"
                  : "bg-muted text-text-secondary hover:text-text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!isLoading && !error && listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-forest-green-50 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary mb-2">
              {statusFilter ? "No matching listings" : "No listings yet"}
            </h2>
            <p className="text-sm text-text-secondary max-w-xs">
              {statusFilter
                ? "Try a different filter."
                : "List items from your inventory on eBay or Etsy with one tap."}
            </p>
          </div>
        )}

        {!isLoading && !error && listings.length > 0 && (
          <div className="flex flex-col gap-2">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
