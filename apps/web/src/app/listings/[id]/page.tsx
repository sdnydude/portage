"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
import type { Listing } from "@portage/shared";

interface ItemPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
}

interface ItemDetail {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  conditionNotes?: string;
  brand?: string;
  model?: string;
  features: string[];
  photos: ItemPhoto[];
  estimatedValueMin: number | null;
  estimatedValueMax: number | null;
  estimatedValueRecommended: number | null;
  aiConfidenceScore: number;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
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

const marketplaceLabels: Record<string, string> = {
  ebay: "eBay",
  etsy: "Etsy",
  reverb: "Reverb",
};

const marketplaceBaseUrls: Record<string, string> = {
  ebay: "https://www.ebay.com/itm/",
  etsy: "https://www.etsy.com/listing/",
  reverb: "https://reverb.com/item/",
};

function getOtherMarketplaces(current: string): string[] {
  return (["ebay", "etsy", "reverb"] as const).filter((m) => m !== current);
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editedPrice, setEditedPrice] = useState<string>("");
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedDescription, setEditedDescription] = useState<string>("");
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const listingData = await api<Listing>(`/listings/${params.id}`, { token });
      setListing(listingData);
      setEditedPrice(String(listingData.price));
      setEditedTitle("");
      setEditedDescription("");

      const itemData = await api<ItemDetail>(`/items/${listingData.itemId}`, { token });
      setItem(itemData);
      setEditedTitle(itemData.title);
      setEditedDescription(itemData.description ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load listing");
    } finally {
      setIsLoading(false);
    }
  }, [token, params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!isAuthenticated) {
    router.replace("/listings");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center max-w-lg mx-auto">
            <button onClick={() => router.back()} className="p-1 -ml-1 text-text-secondary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="ml-3 text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Not Found</span>
          </div>
        </header>
        <div className="px-4 py-16 text-center max-w-lg mx-auto">
          <p className="text-text-secondary">{error ?? "Listing not found"}</p>
          <button onClick={() => router.push("/listings")} className="mt-4 text-sm text-forest-green font-medium">
            Back to listings
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[listing.status] ?? statusConfig.archived;
  const marketplaceLabel = marketplaceLabels[listing.marketplace] ?? listing.marketplace;
  const primaryPhoto = item?.photos?.find((p) => p.isPrimary) ?? item?.photos?.[0];
  const otherMarketplaces = getOtherMarketplaces(listing.marketplace);

  const originalPrice = String(listing.price);
  const originalTitle = item?.title ?? "";
  const originalDescription = item?.description ?? "";

  const hasChanges =
    editedPrice !== originalPrice ||
    editedTitle !== originalTitle ||
    editedDescription !== originalDescription;

  const externalUrl = listing.marketplaceListingId
    ? `${marketplaceBaseUrls[listing.marketplace] ?? ""}${listing.marketplaceListingId}`
    : null;

  const handleSave = async () => {
    if (!token || !listing) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const parsedPrice = parseFloat(editedPrice);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        setSaveError("Please enter a valid price");
        setIsSaving(false);
        return;
      }

      const updated = await api<Listing>(`/listings/${listing.id}`, {
        method: "PATCH",
        token,
        body: { price: parsedPrice },
      });
      setListing(updated);
      setEditedPrice(String(updated.price));
      setEditingPrice(false);
      setEditingTitle(false);
      setEditingDescription(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndListing = async () => {
    if (!token || !listing) return;
    setIsEnding(true);

    try {
      await api(`/listings/${listing.id}`, { method: "DELETE", token });
      router.replace("/listings");
    } catch {
      setIsEnding(false);
      setShowEndConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-text-secondary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="ml-3 text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            Listing Detail
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Status Banner */}
        <div className="px-4 pt-4 flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-text-secondary">
            {marketplaceLabel}
          </span>
        </div>

        {/* Primary Photo */}
        <div className="mt-4 aspect-square bg-muted overflow-hidden">
          {primaryPhoto ? (
            <img
              src={primaryPhoto.url}
              alt={item?.title ?? "Listing photo"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Save Error */}
          {saveError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}

          {/* Editable: Price */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Price</span>
              {!editingPrice ? (
                <button
                  onClick={() => setEditingPrice(true)}
                  className="text-xs text-forest-green font-medium"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditingPrice(false);
                    setEditedPrice(originalPrice);
                  }}
                  className="text-xs text-text-secondary font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
            {editingPrice ? (
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-lg">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editedPrice}
                  onChange={(e) => setEditedPrice(e.target.value)}
                  className="flex-1 text-lg font-semibold text-text-primary bg-transparent border-b border-forest-green outline-none py-0.5"
                  autoFocus
                />
              </div>
            ) : (
              <p className="text-2xl font-bold text-forest-green">
                ${parseFloat(editedPrice).toFixed(2)} {listing.currency}
              </p>
            )}
          </div>

          {/* Editable: Title */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Title</span>
              {!editingTitle ? (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="text-xs text-forest-green font-medium"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditingTitle(false);
                    setEditedTitle(originalTitle);
                  }}
                  className="text-xs text-text-secondary font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
            {editingTitle ? (
              <textarea
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                rows={2}
                className="w-full text-sm text-text-primary bg-transparent border-b border-forest-green outline-none py-0.5 resize-none"
                autoFocus
              />
            ) : (
              <p className="text-sm font-semibold font-[family-name:var(--font-instrument)] text-text-primary leading-snug">
                {editedTitle}
              </p>
            )}
          </div>

          {/* Editable: Description */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Description</span>
              {!editingDescription ? (
                <button
                  onClick={() => setEditingDescription(true)}
                  className="text-xs text-forest-green font-medium"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditingDescription(false);
                    setEditedDescription(originalDescription);
                  }}
                  className="text-xs text-text-secondary font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
            {editingDescription ? (
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={5}
                className="w-full text-sm text-text-primary bg-transparent border-b border-forest-green outline-none py-0.5 resize-none"
                autoFocus
              />
            ) : (
              <p className="text-sm text-text-primary leading-relaxed">
                {editedDescription || <span className="text-text-placeholder italic">No description</span>}
              </p>
            )}
          </div>

          {/* Read-only Fields */}
          {item && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Item Details</h2>
              <div className="grid grid-cols-2 gap-3">
                {item.category && (
                  <ReadOnlyField label="Category" value={item.category} />
                )}
                {item.condition && (
                  <ReadOnlyField label="Condition" value={item.condition.replace("_", " ")} />
                )}
                {item.brand && (
                  <ReadOnlyField label="Brand" value={item.brand} />
                )}
                {item.model && (
                  <ReadOnlyField label="Model" value={item.model} />
                )}
              </div>
            </div>
          )}

          {/* Marketplace Listing ID */}
          {listing.marketplaceListingId && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1">
                {marketplaceLabel} Listing ID
              </span>
              {externalUrl ? (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-forest-green font-medium underline underline-offset-2 break-all"
                >
                  {listing.marketplaceListingId}
                </a>
              ) : (
                <p className="text-sm text-text-primary font-mono break-all">
                  {listing.marketplaceListingId}
                </p>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="bg-surface border border-border rounded-xl p-4 grid grid-cols-2 gap-3">
            <ReadOnlyField
              label="Created"
              value={new Date(listing.createdAt).toLocaleDateString()}
            />
            {listing.publishedAt && (
              <ReadOnlyField
                label="Published"
                value={new Date(listing.publishedAt).toLocaleDateString()}
              />
            )}
            {listing.soldAt && (
              <ReadOnlyField
                label="Sold"
                value={new Date(listing.soldAt).toLocaleDateString()}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-1">
            {/* Save Changes */}
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 rounded-xl bg-forest-green text-white text-sm font-semibold hover:bg-forest-green/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            )}

            {/* View on Marketplace */}
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl border border-forest-green text-forest-green text-sm font-semibold hover:bg-forest-green-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View on {marketplaceLabel}
              </a>
            )}

            {/* End Listing */}
            {listing.status === "active" && (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full py-3 rounded-xl border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                End Listing
              </button>
            )}
          </div>

          {/* Cross-list Nudge */}
          {otherMarketplaces.length > 0 && listing.status !== "sold" && listing.status !== "archived" && (
            <div className="bg-forest-green-50 dark:bg-forest-green/10 border border-forest-green/20 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
                  Also list on {otherMarketplaces.map((m) => marketplaceLabels[m]).join(" or ")}?
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Reach more buyers by cross-listing this item.
                </p>
              </div>
              <button
                onClick={() => router.push(`/list?itemId=${listing.itemId}`)}
                className="w-full py-2.5 rounded-xl bg-forest-green text-white text-sm font-semibold hover:bg-forest-green/90 transition-colors"
              >
                List on Another Marketplace
              </button>
            </div>
          )}
        </div>
      </div>

      {/* End Listing Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowEndConfirm(false)} />
          <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
              End Listing
            </h3>
            <p className="text-sm text-text-secondary">
              Are you sure you want to end this listing on {marketplaceLabel}? This will remove it from the marketplace.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-medium text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleEndListing}
                disabled={isEnding}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {isEnding ? "Ending..." : "End Listing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</span>
      <p className="text-sm text-text-primary mt-0.5 capitalize">{value}</p>
    </div>
  );
}
