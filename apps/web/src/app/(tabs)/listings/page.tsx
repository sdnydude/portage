"use client";

import { useState, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AskPorterBar } from "@/components/porter/ask-porter-bar";
import { BulkListingBar } from "@/components/listing/bulk-listing-bar";
import { useListings } from "@/hooks/use-listings";
import { useAuth } from "@/hooks/use-auth";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { api, ApiError } from "@/lib/api";
import Link from "next/link";
import type { Listing } from "@/hooks/use-listings";
import { ItemDetail } from "@/components/inventory/item-detail";
import { MasterDetail } from "@/components/workbench/master-detail";
import { useListNav } from "@/hooks/use-list-nav";
import { StatusChip, MarketplaceChip } from "@/components/inventory/status-chip";


interface ListingCardProps {
  listing: Listing;
  isSelecting: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onOpen?: () => void;
  isActive?: boolean;
}

function ListingCard({ listing, isSelecting, isSelected, onToggle, onOpen, isActive }: ListingCardProps) {
  const cardContent = (
    <div className={`flex items-center gap-3 p-3 bg-surface rounded-xl border transition-colors ${
      isSelected ? "border-forest-green ring-2 ring-forest-green" : "border-border hover:border-border-focus"
    }`}>
      {isSelecting && (
        <div
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-forest-green border-forest-green" : "bg-surface border-border"
          }`}
          aria-hidden="true"
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <MarketplaceChip marketplace={listing.marketplace} />
          <StatusChip status={listing.status} />
        </div>
        <div className="text-sm font-medium text-text-primary truncate">
          {listing.itemTitle ?? "Untitled item"}
        </div>
        <div className="text-sm text-text-secondary">
          ${listing.price.toFixed(2)} {listing.currency}
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          {listing.publishedAt
            ? `Published ${new Date(listing.publishedAt).toLocaleDateString()}`
            : `Created ${new Date(listing.createdAt).toLocaleDateString()}`}
        </div>
      </div>
      {!isSelecting && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-placeholder flex-shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </div>
  );

  if (isSelecting) {
    return (
      <button
        onClick={() => onToggle(listing.id)}
        className="w-full text-left focus:outline-none"
        aria-pressed={isSelected}
        aria-label={`${isSelected ? "Deselect" : "Select"} listing for $${listing.price.toFixed(2)} on ${listing.marketplace}`}
      >
        {cardContent}
      </button>
    );
  }

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-item-id={listing.id}
        aria-current={isActive ? "true" : undefined}
        className={`w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-green ${isActive ? "ring-2 ring-forest-green rounded-xl" : ""}`}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <Link href={`/inventory/${listing.itemId}?listing=${listing.id}`}>
      {cardContent}
    </Link>
  );
}

export default function ListingsPage() {
  const { isAuthenticated, token } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const { listings, isLoading, error, refetch } = useListings({ status: statusFilter || undefined });
  const { selectedIds, isSelecting, toggle, selectAll, clearSelection, toggleSelecting, selectedCount } = useBulkSelect<Listing>();
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  // Parity with the inventory pane (which passes a raw id to a fetch-by-id
  // ItemDetail and so survives filter-out): cache the last resolved listing so
  // a status-filter change that drops it from the loaded set keeps the pane
  // open instead of collapsing to the empty hint.
  const [selectedSnapshot, setSelectedSnapshot] = useState<Listing | null>(null);
  const foundListing = listings.find((l) => l.id === selectedListingId) ?? null;
  useEffect(() => {
    if (foundListing) setSelectedSnapshot(foundListing);
    else if (selectedListingId === null) setSelectedSnapshot(null);
  }, [foundListing, selectedListingId]);
  const selectedListing =
    foundListing ?? (selectedSnapshot?.id === selectedListingId ? selectedSnapshot : null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("listing");
    if (id) setSelectedListingId(id);
  }, []);

  const selectListing = useCallback((id: string) => {
    setSelectedListingId(id);
    window.history.replaceState(null, "", `/listings?listing=${id}`);
  }, []);

  const clearDetailSelection = useCallback(() => {
    setSelectedListingId(null);
    window.history.replaceState(null, "", "/listings");
  }, []);

  const { onKeyDown: onListKeyDown } = useListNav({
    ids: listings.map((l) => l.id),
    selectedId: selectedListingId,
    onSelect: selectListing,
  });

  useEffect(() => {
    if (!selectedListingId) return;
    document
      .querySelector(`[data-item-id="${selectedListingId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedListingId]);

  const statusFilters = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "draft", label: "Drafts" },
    { value: "sold", label: "Sold" },
    { value: "archived", label: "Archived" },
  ];

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0 || !token) return;
    const confirmed = window.confirm(`Delete ${selectedIds.size} listing${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`);
    if (!confirmed) return;

    setBulkLoading(true);
    setBulkError(null);
    try {
      await api("/listings/bulk/delete", {
        method: "POST",
        body: { ids: Array.from(selectedIds) },
        token,
      });
      // Clear a deleted pane selection — the pane self-heals visually after
      // refetch, but the stale ?listing= deep link would 404 on reload.
      if (selectedListingId && selectedIds.has(selectedListingId)) clearDetailSelection();
      clearSelection();
      await refetch();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to delete listings");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, token, selectedListingId, clearDetailSelection, clearSelection, refetch]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0 || !token) return;
    const confirmed = window.confirm(`Archive ${selectedIds.size} listing${selectedIds.size !== 1 ? "s" : ""}? Active listings will be removed from their marketplace.`);
    if (!confirmed) return;

    setBulkLoading(true);
    setBulkError(null);
    try {
      await api("/listings/bulk/archive", {
        method: "POST",
        body: { ids: Array.from(selectedIds) },
        token,
      });
      clearSelection();
      await refetch();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to archive listings");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, token, clearSelection, refetch]);

  const handleBulkActivate = useCallback(async () => {
    if (selectedIds.size === 0 || !token) return;

    setBulkLoading(true);
    setBulkError(null);
    try {
      await api("/listings/bulk/activate", {
        method: "POST",
        body: { ids: Array.from(selectedIds) },
        token,
      });
      clearSelection();
      await refetch();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to activate listings");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, token, clearSelection, refetch]);

  if (!isAuthenticated) {
    return (
      <>
        <PageHeader title="Listings" subtitle="Your marketplace listings" showAvatar />
        <div className="px-4 py-6 content-container">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-text-secondary">Sign in to manage your listings.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="lg:hidden">
        <PageHeader
          title="Listings"
          subtitle={listings.length > 0 ? `${listings.length} listing${listings.length !== 1 ? "s" : ""}` : undefined}
          showAvatar
          action={
            listings.length > 0 ? (
              <button
                onClick={toggleSelecting}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isSelecting
                    ? "bg-forest-green text-white"
                    : "bg-muted text-text-secondary hover:text-text-primary"
                }`}
              >
                {isSelecting ? "Done" : "Select"}
              </button>
            ) : undefined
          }
        />
        <div className="lg:hidden px-4 pt-3 content-container w-full">
          <AskPorterBar />
        </div>
        <div className="px-4 py-3 content-container space-y-3">
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

          {bulkError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
              {bulkError}
            </div>
          )}

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
                  : "List items from your inventory on eBay or Reverb."}
              </p>
            </div>
          )}

          {!isLoading && !error && listings.length > 0 && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isSelecting={isSelecting}
                  isSelected={selectedIds.has(listing.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar — shown above tab bar when in select mode with listings selected */}
      {isSelecting && (
        <BulkListingBar
          selectedCount={selectedCount}
          totalCount={listings.length}
          onSelectAll={() => selectAll(listings)}
          onClear={clearSelection}
          onDelete={handleBulkDelete}
          onArchive={handleBulkArchive}
          onActivate={handleBulkActivate}
          isLoading={bulkLoading}
        />
      )}

      <MasterDetail
        listLabel="Listings list"
        list={
          <div className="space-y-3 p-4 outline-none" tabIndex={0} onKeyDown={onListKeyDown} aria-label="Listings — use arrow keys to browse">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-secondary">
                {listings.length} listing{listings.length !== 1 ? "s" : ""}
              </span>
              {listings.length > 0 && (
                <button
                  onClick={toggleSelecting}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isSelecting
                      ? "bg-forest-green text-white"
                      : "bg-muted text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {isSelecting ? "Done" : "Select"}
                </button>
              )}
            </div>
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
              <div data-testid="list-pane-loading" className="flex items-center justify-center py-16">
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
                <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary mb-2">
                  {statusFilter ? "No matching listings" : "No listings yet"}
                </h2>
                <p className="text-sm text-text-secondary max-w-xs">
                  {statusFilter
                    ? "Try a different filter."
                    : "List items from your inventory on eBay or Reverb."}
                </p>
              </div>
            )}
            {!isLoading && !error && listings.length > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isSelecting={isSelecting}
                    isSelected={selectedIds.has(listing.id)}
                    onToggle={toggle}
                    onOpen={isSelecting ? undefined : () => selectListing(listing.id)}
                    isActive={listing.id === selectedListingId}
                  />
                ))}
              </div>
            )}
          </div>
        }
        detail={
          selectedListing ? (
            <ItemDetail
              key={selectedListing.id}
              itemId={selectedListing.itemId}
              focusListingId={selectedListing.id}
              variant="pane"
              onDeleted={() => {
                clearDetailSelection();
                refetch();
              }}
              onBack={clearDetailSelection}
            />
          ) : selectedListingId && !isLoading && !error ? (
            // Deep link to an unknown/deleted/filtered-out id — say so
            // instead of the generic hint (silent miss).
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-text-secondary">
                Listing not found — it may have been deleted or filtered out.
              </p>
              <button
                onClick={clearDetailSelection}
                className="text-sm font-medium text-forest-green"
              >
                Clear selection
              </button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-text-secondary">Select a listing to view and edit it</p>
            </div>
          )
        }
      />
    </>
  );
}
