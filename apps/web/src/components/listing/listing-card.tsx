"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { nextGtcRenewal } from "@/lib/gtc";
import type { Listing } from "@/hooks/use-listings";
import { api, ApiError } from "@/lib/api";
import { marketplaceItemUrl } from "@/lib/marketplace-urls";
import { formatCurrency, formatMarketplace } from "@/lib/format";
import { parsePriceInput } from "@/lib/price";
import { AspectFillSheet, type AspectRequirement } from "./aspect-fill-sheet";
import { ShippingFieldsSection, SHIPPING_FIELDS_DEFAULT, type ShippingFieldsValue } from "./shipping-fields-section";
import type { ListingSyncStatus } from "@/lib/sync-status";
import { WeightFillSheet } from "./weight-fill-sheet";
import type { WeightDimsValue } from "./weight-dims-inputs";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";

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
  /**
   * Aspect-sheet prefill (Brand/Model already known on the item). The card
   * doesn't hold the item; the item page passes these from its loaded item.
   */
  itemBrand?: string;
  itemModel?: string;
  /** P3 sync truth surface: badge state from useSyncStatus (undefined = no badge). */
  syncStatus?: ListingSyncStatus;
  onRetrySync?: (listingId: string) => Promise<void>;
}

/**
 * Per-listing card on the item detail hub. Read-only in Task 2; Task 3 adds
 * the action surface (price edit, publish, archive, delete, relist).
 * `token`/`onChanged` are part of the stable contract those actions consume.
 */
export function ListingCard({ listing, token, onChanged, highlight, itemBrand, itemModel, syncStatus, onRetrySync }: ListingCardProps) {
  const router = useRouter();
  const status = statusConfig[listing.status] ?? statusConfig.draft;
  const currency = listing.currency || "USD";
  // The code suffix is the only non-USD signal (ported rule from the old
  // detail page) — never drop it for Reverb listings.
  const price = `${formatCurrency(listing.price, currency)}${currency !== "USD" ? ` ${currency}` : ""}`;
  const marketplaceLabel = formatMarketplace(listing.marketplace);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionWarning, setActionWarning] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [editedPrice, setEditedPrice] = useState(String(listing.price));
  const [isSaving, setIsSaving] = useState(false);
  const priceDirty = editingPrice && editedPrice !== String(listing.price);

  const handleSavePrice = async () => {
    if (!token) return;
    // Ported guard (old page): reject before the PATCH ever fires.
    const parsedPrice = parsePriceInput(editedPrice);
    if (parsedPrice == null) {
      setActionError("Please enter a valid price");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    setActionWarning(null);
    try {
      const updated = await api<Listing & { warning?: string }>(`/listings/${listing.id}`, {
        method: "PATCH",
        token,
        body: { price: parsedPrice },
      });
      if (updated.warning) setActionWarning(updated.warning);
      setEditingPrice(false);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };
  const [aspectMissing, setAspectMissing] = useState<AspectRequirement[] | null>(null);
  const [aspectSaving, setAspectSaving] = useState(false);
  const [aspectError, setAspectError] = useState<string | null>(null);
  // Shipping edit (beta 17be7322): inline editor seeded from the stored
  // ebayShipping. PATCH full-replaces marketplaceSpecificFields server-side,
  // so save must client-side spread the stored keys (aspect-merge pattern).
  const [editingShipping, setEditingShipping] = useState(false);
  const [shipFields, setShipFields] = useState<ShippingFieldsValue>(SHIPPING_FIELDS_DEFAULT);
  const [shippingSaving, setShippingSaving] = useState(false);

  const handleOpenShipping = () => {
    const stored = ((listing.marketplaceSpecificFields ?? {}) as Record<string, unknown>).ebayShipping as
      | { method?: string; flatCost?: number; service?: string; handlingDays?: number }
      | undefined;
    setShipFields({
      method: (stored?.method as ShippingFieldsValue["method"]) ?? "calculated",
      flatCost: stored?.flatCost != null ? String(stored.flatCost) : "",
      service: stored?.service ?? "",
      handlingDays: stored?.handlingDays != null ? String(stored.handlingDays) : "",
    });
    setEditingShipping(true);
  };

  const handleSaveShipping = async () => {
    if (!token) return;
    setShippingSaving(true);
    setActionError(null);
    setActionWarning(null);
    try {
      const cost = parseFloat(shipFields.flatCost);
      const days = parseInt(shipFields.handlingDays, 10);
      const ebayShipping = {
        method: shipFields.method,
        ...(shipFields.method === "flat" && cost > 0 ? { flatCost: cost } : {}),
        ...(shipFields.service ? { service: shipFields.service } : {}),
        ...(days >= 0 && shipFields.handlingDays !== "" ? { handlingDays: days } : {}),
      };
      const existing = (listing.marketplaceSpecificFields ?? {}) as Record<string, unknown>;
      const updated = await api<Listing & { warning?: string }>(`/listings/${listing.id}`, {
        method: "PATCH",
        token,
        body: { marketplaceSpecificFields: { ...existing, ebayShipping } },
      });
      if (updated.warning) setActionWarning(updated.warning);
      setEditingShipping(false);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save shipping");
    } finally {
      setShippingSaving(false);
    }
  };
  const [weightMissing, setWeightMissing] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    if (!listing.marketplaceListingId) return;
    try {
      await navigator.clipboard.writeText(listing.marketplaceListingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard needs a secure context (undefined on plain-HTTP LAN) and
      // button text isn't drag-selectable — surface the failure, don't eat it.
      setActionError("Couldn't copy — clipboard needs HTTPS");
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await api(`/listings/${listing.id}`, { method: "DELETE", token });
      setShowDeleteConfirm(false);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete listing");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!token) return;
    setIsArchiving(true);
    setActionError(null);
    setActionWarning(null);
    try {
      const updated = await api<Listing & { warning?: string }>(`/listings/${listing.id}`, {
        method: "PATCH",
        token,
        body: { status: "archived" },
      });
      if (updated.warning) setActionWarning(updated.warning);
      setShowArchiveConfirm(false);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to archive listing");
    } finally {
      setIsArchiving(false);
    }
  };

  // Shared success tail of every publish path (initial, post-weight,
  // post-aspects): POST, surface the server warning, refresh the parent.
  // The three catch blocks stay separate — their error routing intentionally
  // differs (ported behavior).
  const publishAndRefresh = async () => {
    if (!token) return;
    const updated = await api<Listing & { warning?: string }>(`/listings/${listing.id}/publish`, { method: "POST", token });
    setActionWarning(updated.warning ?? null);
    onChanged();
  };

  const handlePublish = async () => {
    if (!token) return;
    setIsPublishing(true);
    setActionError(null);
    setActionWarning(null);
    try {
      await publishAndRefresh();
    } catch (err) {
      // eBay needs category-required item specifics — collect them, then re-publish.
      if (err instanceof ApiError && err.code === "EBAY_ASPECTS_REQUIRED") {
        setAspectMissing((err.details as unknown as AspectRequirement[]) ?? []);
      } else if (err instanceof ApiError && err.code === "EBAY_WEIGHT_REQUIRED") {
        // Calculated shipping needs package weight/dims — collect, then re-publish.
        setWeightMissing(true);
      } else {
        setActionError(err instanceof ApiError ? err.message : "Failed to publish listing");
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleWeightSave = async (value: WeightDimsValue) => {
    if (!token) return;
    setWeightSaving(true);
    setWeightError(null);
    try {
      // Persist weight/dims to the item columns (publish source of truth), then
      // re-publish. weight is decimal pounds; the column is ounces.
      const rawOz = value.weight != null ? Math.round(value.weight * 16) : 0;
      await api(`/items/${listing.itemId}`, {
        method: "PATCH",
        token,
        body: {
          weightOz: rawOz > 0 ? rawOz : undefined,
          lengthIn: value.dimLength ?? undefined,
          widthIn: value.dimWidth ?? undefined,
          heightIn: value.dimHeight ?? undefined,
          ebayPackageType: value.ebayPackageType ?? undefined,
          weightEstimated: false,
        },
      });
      await publishAndRefresh();
      setWeightMissing(false);
    } catch (err) {
      // A cascade (eBay then surfaced required specifics) hands off to the aspect
      // sheet; anything else is shown inline in the weight sheet.
      if (err instanceof ApiError && err.code === "EBAY_ASPECTS_REQUIRED") {
        setWeightMissing(false);
        setAspectMissing((err.details as unknown as AspectRequirement[]) ?? []);
      } else if (err instanceof ApiError && err.code === "EBAY_WEIGHT_REQUIRED") {
        setWeightError("Add the package weight and dimensions to continue.");
      } else {
        setWeightError(err instanceof ApiError ? err.message : "Failed to publish listing");
      }
    } finally {
      setWeightSaving(false);
    }
  };

  const handleAspectsSave = async (aspects: Record<string, string[]>) => {
    if (!token) return;
    setAspectSaving(true);
    setAspectError(null);
    try {
      // Merge the filled specifics into the listing's marketplaceSpecificFields,
      // then re-publish. The publish gate re-validates server-side.
      const existing = (listing.marketplaceSpecificFields ?? {}) as Record<string, unknown>;
      const existingAspects = (existing.aspects as Record<string, string[]> | undefined) ?? {};
      await api(`/listings/${listing.id}`, {
        method: "PATCH",
        token,
        body: { marketplaceSpecificFields: { ...existing, aspects: { ...existingAspects, ...aspects } } },
      });
      await publishAndRefresh();
      setAspectMissing(null);
    } catch (err) {
      // A cascade (eBay surfaced more required specifics) keeps the sheet open
      // with the new list; anything else is shown inline in the sheet.
      if (err instanceof ApiError && err.code === "EBAY_ASPECTS_REQUIRED") {
        setAspectMissing((err.details as unknown as AspectRequirement[]) ?? []);
        setAspectError("eBay needs a few more details to publish.");
      } else {
        setAspectError(err instanceof ApiError ? err.message : "Failed to publish listing");
      }
    } finally {
      setAspectSaving(false);
    }
  };

  return (
    <div
      className={`bg-surface border border-border rounded-xl p-3 transition-shadow ${
        highlight ? "ring-2 ring-(--teal)" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">
          {marketplaceLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {syncStatus && (
            <span
              data-testid={`sync-badge-${listing.id}`}
              title={syncStatus.message ?? `Last sync attempt ${new Date(syncStatus.lastAttemptAt).toLocaleString()}`}
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                syncStatus.state === "pending"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : syncStatus.state === "failed"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {syncStatus.state === "pending" ? "Syncing…" : syncStatus.state === "failed" ? "Sync failed" : "Synced"}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </span>
      </div>
      {syncStatus?.state === "failed" && (
        <div className="mt-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2 text-sm text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
          <span>{syncStatus.message ?? "The last marketplace sync failed."}</span>
          {onRetrySync && (
            <button
              onClick={() => { void onRetrySync(listing.id); }}
              className="shrink-0 px-2 py-0.5 rounded-lg border border-red-300 dark:border-red-700 text-xs font-medium"
            >
              Retry sync
            </button>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        {editingPrice ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary text-sm">$</span>
              <input
                aria-label="Price"
                type="number"
                inputMode="decimal"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
                className="w-28 pl-6 pr-2 py-1.5 rounded-lg border border-border bg-background text-sm text-text-primary"
              />
            </div>
            <button
              onClick={handleSavePrice}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-forest-green text-white text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                // No re-seed needed: opening the editor always seeds fresh.
                setEditingPrice(false);
                setActionError(null);
              }}
              className="px-2 py-1.5 text-sm text-text-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-base font-semibold text-text-primary">
            {price}
            {listing.status !== "sold" && (
              <button
                aria-label="Edit price"
                onClick={() => {
                  setEditedPrice(String(listing.price));
                  setEditingPrice(true);
                }}
                className="p-1 text-text-secondary hover:text-text-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            )}
          </span>
        )}
        <span className="text-xs text-text-secondary text-right">
          {listing.soldAt
            ? `Sold ${new Date(listing.soldAt).toLocaleDateString()}`
            : listing.publishedAt
              ? `Listed ${new Date(listing.publishedAt).toLocaleDateString()}`
              : `Created ${new Date(listing.createdAt).toLocaleDateString()}`}
        </span>
      </div>
      {listing.status === "active" && listing.marketplace === "ebay" && listing.publishedAt && (
        <GtcDateLine publishedAt={listing.publishedAt} token={token} />
      )}
      {/* Title/description edit lives ONLY on the item edit page (kills the
          old overlapping-edit-surface bug) — quiet link so sellers find it. */}
      {listing.status !== "sold" && (
        <a
          href={`/inventory/${listing.itemId}/edit`}
          className="mt-1 inline-block text-xs text-text-secondary underline underline-offset-2"
        >
          Edit title &amp; description
        </a>
      )}
      {/* Shipping edit — eBay only (Reverb shipping is profile-driven). */}
      {listing.marketplace === "ebay" && listing.status !== "sold" && !editingShipping && (
        <button
          onClick={handleOpenShipping}
          className="mt-1 ml-3 text-xs text-text-secondary underline underline-offset-2"
        >
          Edit shipping
        </button>
      )}
      {editingShipping && (
        <div className="mt-2 space-y-3 border border-border rounded-xl p-3">
          <ShippingFieldsSection idPrefix={`card-${listing.id}-`} value={shipFields} onChange={setShipFields} />
          <div className="flex gap-2">
            <button
              onClick={handleSaveShipping}
              disabled={shippingSaving}
              className="px-3 py-1.5 rounded-lg bg-forest-green text-white text-sm font-medium disabled:opacity-50"
            >
              {shippingSaving ? "Saving..." : "Save shipping"}
            </button>
            <button
              onClick={() => { setEditingShipping(false); setActionError(null); }}
              className="px-2 py-1.5 text-sm text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {actionError && (
        <div className="mt-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}
      {actionWarning && (
        <div className="mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2 text-sm text-amber-700 dark:text-amber-300">
          {actionWarning}
        </div>
      )}
      {listing.marketplaceListingId && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <a
            href={marketplaceItemUrl(listing.marketplace, listing.marketplaceListingId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-(--teal) font-medium"
          >
            View on {marketplaceLabel} ↗
          </a>
          {/* Raw ID: used directly for Seller Hub lookups; diagnostic (eBay
              3-prefix = live Trading listing, 1-prefix = orphaned offer). */}
          <button
            onClick={handleCopyId}
            title="Copy listing ID"
            className="text-xs text-text-secondary font-[family-name:var(--font-jetbrains)]"
          >
            {copied ? "Copied" : listing.marketplaceListingId}
          </button>
        </div>
      )}
      {listing.status === "draft" && (
        <button
          onClick={handlePublish}
          disabled={isPublishing || !token || priceDirty}
          title={priceDirty ? "Save your changes before publishing" : undefined}
          className="w-full mt-2 py-2.5 rounded-xl bg-forest-green text-white text-sm font-semibold disabled:opacity-50"
        >
          {isPublishing ? "Publishing..." : `Publish to ${marketplaceLabel}`}
        </button>
      )}
      {listing.status === "active" && (
        <button
          onClick={() => setShowArchiveConfirm(true)}
          className="w-full mt-2 py-2 rounded-xl border border-amber-300 text-amber-600 dark:text-amber-400 text-sm font-medium"
        >
          Archive Listing
        </button>
      )}
      {(listing.status === "sold" || listing.status === "archived") && (
        <button
          onClick={() => router.push(`/list?itemId=${listing.itemId}`)}
          className="w-full mt-2 py-2 rounded-xl bg-forest-green text-white text-sm font-medium"
        >
          Relist Item
        </button>
      )}
      {(listing.status === "draft" || listing.status === "archived") && (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full mt-2 py-2 rounded-xl border border-red-300 text-red-600 text-sm font-medium"
        >
          Delete Listing
        </button>
      )}
      {showDeleteConfirm && (
        <ConfirmSheet
          title="Delete Listing"
          body="This will permanently remove this listing. This action cannot be undone."
          confirmLabel="Delete"
          busyLabel="Deleting..."
          busy={isDeleting}
          destructive
          onConfirm={handleDelete}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
      {showArchiveConfirm && (
        <ConfirmSheet
          title="Archive Listing"
          body={`This will archive your listing and attempt to remove it from ${marketplaceLabel}. You can relist the item later.`}
          confirmLabel="Archive"
          busyLabel="Archiving..."
          busy={isArchiving}
          onConfirm={handleArchive}
          onClose={() => setShowArchiveConfirm(false)}
        />
      )}
      {aspectMissing && (
        <AspectFillSheet
          missing={aspectMissing}
          initial={{
            ...(itemBrand ? { Brand: [itemBrand] } : {}),
            ...(itemModel ? { Model: [itemModel] } : {}),
          }}
          marketplaceLabel={marketplaceLabel}
          saving={aspectSaving}
          error={aspectError}
          onCancel={() => {
            setAspectMissing(null);
            setAspectError(null);
          }}
          onSave={handleAspectsSave}
        />
      )}
      {weightMissing && (
        <WeightFillSheet
          marketplaceLabel={marketplaceLabel}
          saving={weightSaving}
          error={weightError}
          onCancel={() => {
            setWeightMissing(false);
            setWeightError(null);
          }}
          onSave={handleWeightSave}
        />
      )}
    </div>
  );
}

// GTC listings renew monthly. Ported from listings/[id]/page.tsx GtcDateField.
// NOTE: fetches the user-level gtcAutoEnd flag at leaf depth — fine while the
// item page renders at most one active eBay card, but a future multi-item
// consumer of ListingCard should lift this fetch to the page and pass a prop.
function GtcDateLine({ publishedAt, token }: { publishedAt: string | Date; token: string | null }) {
  const [autoEnd, setAutoEnd] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ profile: { gtcAutoEnd?: boolean } }>("/seller-profile", { token })
      .then((data) => {
        if (!cancelled) setAutoEnd(data.profile?.gtcAutoEnd ?? false);
      })
      .catch(() => {
        if (!cancelled) setAutoEnd(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  if (autoEnd === null) return null;

  const renewal = nextGtcRenewal(new Date(publishedAt));
  const shown = autoEnd ? new Date(renewal.getTime() - 2 * 24 * 60 * 60 * 1000) : renewal;
  return (
    <p className="mt-1 text-xs text-text-secondary">
      {autoEnd ? "Auto-ends" : "GTC renews"} {shown.toLocaleDateString()}
    </p>
  );
}
