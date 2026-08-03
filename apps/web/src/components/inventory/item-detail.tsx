"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useItem } from "@/hooks/use-item";
import { useListings } from "@/hooks/use-listings";
import { ListingCard } from "@/components/listing/listing-card";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useEnhance } from "@/hooks/use-enhance";
import { useBgRemoval } from "@/hooks/use-bg-removal";
import { PhotoGalleryStrip } from "@/components/capture/photo-gallery-strip";
import { PhotoEditPanel } from "@/components/capture/photo-edit-panel";
import { CreateListingSheet } from "@/components/listing/create-listing-sheet";
import { ListingOptimizerPanel } from "@/components/listing/listing-optimizer-panel";
import { CropTool } from "@/components/listing-flow/crop-tool";
import { ExposureTool } from "@/components/capture/exposure-tool";
import { useComps } from "@/hooks/use-comps";
import { usePublishCurrentItem } from "@/hooks/use-current-item";
import { api, apiUpload } from "@/lib/api";
import { MAX_PHOTOS_PER_ITEM } from "@portage/shared";
import type { CompListing, ItemPhoto } from "@portage/shared";
import { movePhoto, removePhotoAt } from "@/lib/photos";
import { formatCondition } from "@/lib/format";
import { resolvePublishPriceWithSource } from "@/lib/price";

const conditionColors: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  like_new: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  good: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  fair: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  poor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// Card ordering: GTC auto-end + relist cycles accumulate archived rows, and
// createdAt desc can stack them above the live card. Live state first.
const STATUS_ORDER = { active: 0, draft: 1, sold: 2, archived: 3 } as const;

interface ItemDetailProps {
  itemId: string;
  focusListingId?: string | null;
  variant?: "page" | "pane";
  onDeleted: () => void;
  onBack: () => void;
}

export function ItemDetail({
  itemId,
  focusListingId = null,
  variant = "page",
  onDeleted,
  onBack,
}: ItemDetailProps) {
  const router = useRouter();
  const { isAuthenticated, token } = useAuth();
  // Publish the on-screen item so the Porter dock is context-aware (Phase R3).
  usePublishCurrentItem(itemId);
  const { item, isLoading, error, deleteItem, updateItem, refetch: refetchItem } = useItem(itemId);
  const { isProcessing: isEnhancing, result: enhanceResult, error: enhanceError, enhance, reset: resetEnhance } = useEnhance();
  const { isProcessing: isRemovingBg, resultUrl: bgResultUrl, resultKey: bgResultKey, error: bgError, removeBackground, reset: resetBgRemoval } = useBgRemoval();
  const [photoIndex, setPhotoIndex] = useState(0);
  // Which photo the full-screen editor overlay is open for (null = closed).
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [showExposure, setShowExposure] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [showListingSheet, setShowListingSheet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // True while a photo-save PATCH is in flight — on a Reverb-published item
  // that PATCH runs a synchronous marketplace photo re-sync and takes seconds;
  // tools/accepts must serialize behind it (photo-race review, 2026-08-02).
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  // Ref twin for same-tick reentrancy (a double-tap lands before the state
  // commit); state drives the UI, the ref drives the guard.
  const isSavingPhotoRef = useRef(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedCompUrl, setExpandedCompUrl] = useState<string | null>(null);
  const { comps, isLoading: compsLoading, error: compsError, fetchComps } = useComps(itemId);
  const isToolProcessing = isRotating || isEnhancing || isRemovingBg || isSavingPhoto;

  // Optimistic photo order: live drag moves update pendingPhotos instantly;
  // ONE coalesced PATCH commits on release (adversarial-review fix — a PATCH
  // per drop meant a full eBay revise per gesture plus a stale-state race).
  const [pendingPhotos, setPendingPhotos] = useState<ItemPhoto[] | null>(null);
  const pendingPhotosRef = useRef<ItemPhoto[] | null>(null);
  // Always-fresh photo array for async callbacks (photo tools resolve their
  // write target against this at response time, not their stale closure).
  const photosRef = useRef<ItemPhoto[]>([]);
  useEffect(() => {
    photosRef.current = pendingPhotos ?? item?.photos ?? [];
  }, [pendingPhotos, item]);

  // Photo tools capture a target photo, await a network round trip, then
  // write back. Resolve the write slot by stable key at WRITE time against
  // photosRef (index fallback for keyless GetItem-imported photos) so a
  // concurrent order change can't land the edit on the wrong photo.
  const applyToPhoto = useCallback(
    (target: { key?: string }, fallbackIndex: number, patch: Partial<ItemPhoto>): ItemPhoto[] | null => {
      const base = photosRef.current;
      // Prefer the stable key; fall back to the index slot when the key is
      // gone — tool saves ROTATE keys (enhance/rotate mint new R2 objects), and
      // reorders never change keys, so the slot is still the right target.
      const byKey = target.key ? base.findIndex((p) => p.key === target.key) : -1;
      const idx = byKey >= 0 ? byKey : fallbackIndex;
      if (idx < 0 || !base[idx]) return null;
      return base.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    },
    [],
  );

  const handlePhotoReorder = useCallback((from: number, to: number) => {
    const next = movePhoto(photosRef.current, from, to);
    pendingPhotosRef.current = next;
    // Synchronous ref update too: pointermove bursts can outrun the commit
    // cycle, and the next onMove must see this move's result.
    photosRef.current = next;
    setPendingPhotos(next);
  }, []);

  // Fresh listings for the last-photo delete guard (handler is declared
  // before the useListings destructure below).
  const listingsRef = useRef<{ status: string }[]>([]);
  // Fetch state for the same guard: [] from a loading/errored fetch must not
  // read as "no active listing" (fail closed, not open).
  const listingsFetchRef = useRef<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  });

  const handlePhotoDelete = useCallback(async (index: number) => {
    // eBay's Revise omits PictureDetails entirely for an empty photo list —
    // the old pictures silently stay live while the app shows none. Block the
    // divergence at the source.
    if (photosRef.current.length <= 1) {
      const { loading, error } = listingsFetchRef.current;
      if (loading || error) {
        setUploadError("Can't verify listing status — retry loading listings before removing the last photo.");
        return;
      }
      if (listingsRef.current.some((l) => l.status === "active")) {
        setUploadError("Can't remove the last photo while a listing is live — add a replacement photo first.");
        return;
      }
    }
    try {
      const saved = (await updateItem({ photos: removePhotoAt(photosRef.current, index) })) as { syncWarnings?: string[] } | null;
      if (saved?.syncWarnings?.length) setUploadError(saved.syncWarnings.join(" · "));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to delete photo");
    }
  }, [updateItem]);

  const handlePhotoReorderEnd = useCallback(async () => {
    const next = pendingPhotosRef.current;
    if (!next) return;
    pendingPhotosRef.current = null;
    try {
      const saved = (await updateItem({ photos: next })) as { syncWarnings?: string[] } | null;
      if (saved?.syncWarnings?.length) setUploadError(saved.syncWarnings.join(" · "));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to save photo order");
    } finally {
      // Fall back to the server-confirmed order (or revert on failure).
      setPendingPhotos(null);
    }
  }, [updateItem]);

  // Marketplace Listings hub (listing-hub Task 2): this page is becoming the
  // single canonical detail page; each listing renders as a ListingCard.
  const { listings: itemListings, isLoading: listingsLoading, error: listingsError, refetch: refetchListings } =
    useListings({ itemId });
  useEffect(() => {
    listingsRef.current = itemListings;
    listingsFetchRef.current = { loading: listingsLoading, error: listingsError };
  }, [itemListings, listingsLoading, listingsError]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // One-shot: without the ref, every refetchListings() toggles listingsLoading
  // and this effect would re-yank scroll to the card after every card action.
  // The ref is only set once the card element is actually found — an archived
  // target isn't in the DOM until the archive section expands, so marking
  // "handled" any earlier would silently drop the deep link.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !focusListingId || listingsLoading || isLoading) return;
    const target = itemListings.find((l) => l.id === focusListingId);
    if (target?.status === "archived" && !showArchived) {
      setShowArchived(true);
      return; // re-runs once the archived cards are in the DOM
    }
    // Double-rAF so layout settles before measuring; instant (not smooth) —
    // smooth-scrolling a long mobile page is seconds of jank.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`listing-${focusListingId}`);
      if (!el) return;
      scrolledRef.current = true;
      el.scrollIntoView({ block: "center" });
      setHighlightId(focusListingId);
      setTimeout(() => setHighlightId(null), 2000);
    }));
  }, [focusListingId, listingsLoading, isLoading, itemListings, showArchived]);

  const orderedListings = [...itemListings].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
  const visibleListings = orderedListings.filter((l) => l.status !== "archived");
  const archivedListings = orderedListings.filter((l) => l.status === "archived");
  const availableMarketplaces = (["ebay", "reverb"] as const).filter(
    (m) => !visibleListings.some((l) => l.marketplace === m),
  );
  // P3 truth surface: one batched status fetch for every listing on the page;
  // cards render the badge and the failed-state retry.
  const { syncStatuses, retrySync } = useSyncStatus(itemListings.map((l) => l.id), token);
  const renderListingCard = (l: (typeof itemListings)[number]) => (
    <div key={l.id} id={`listing-${l.id}`}>
      <ListingCard
        listing={l}
        token={token}
        onChanged={refetchListings}
        highlight={l.id === highlightId}
        itemBrand={item?.brand || undefined}
        itemModel={item?.model || undefined}
        syncStatus={syncStatuses[l.id]}
        onRetrySync={retrySync}
      />
    </div>
  );

  const handleAddPhotos = useCallback(
    async (files: File[]) => {
      if (!token || !item) return;
      setIsUploading(true);
      setUploadError(null);

      try {
        const newPhotos = [];
        let failCount = 0;
        // First failure's message rides along in the summary so systemic
        // causes (auth, size limit, rembg outage) are distinguishable.
        let firstFailure: string | null = null;
        for (const file of files) {
          const formData = new FormData();
          formData.append("image", file);
          try {
            const data = await apiUpload<{
              image: { url: string; key: string; width: number; height: number };
            }>("/images", formData, { token });
            newPhotos.push({
              url: data.image.url,
              key: data.image.key,
              width: data.image.width,
              height: data.image.height,
              isPrimary: false,
            });
          } catch (err) {
            failCount++;
            if (!firstFailure) firstFailure = err instanceof Error ? err.message : String(err);
          }
        }

        if (newPhotos.length > 0) {
          const updatedPhotos = [...(item.photos ?? []), ...newPhotos];
          await updateItem({ photos: updatedPhotos });
        }

        if (failCount > 0 && newPhotos.length === 0) {
          setUploadError(`All photos failed to upload — ${firstFailure}`);
        } else if (failCount > 0) {
          setUploadError(`${failCount} photo(s) failed to upload and were skipped — ${firstFailure}`);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to save photos");
      } finally {
        setIsUploading(false);
      }
    },
    [token, item, updateItem],
  );

  const handleSaveEditedPhoto = useCallback(
    async (newUrl: string, newKey?: string) => {
      if (!item || isSavingPhotoRef.current) return;
      // Anchor on the DISPLAYED array (pendingPhotos-aware) — item.photos can
      // lag it during a reorder commit, which mis-anchored the write.
      const target = photosRef.current[photoIndex];
      if (!target) return;
      const updatedPhotos = applyToPhoto(target, photoIndex, {
        url: newUrl,
        ...(newKey ? { key: newKey } : {}),
      });
      if (!updatedPhotos) {
        setUploadError("Photo changed while editing — please retry.");
        // Clear the stale before/after preview too, or "retry" re-offers the
        // same doomed accept forever.
        resetEnhance();
        resetBgRemoval();
        return;
      }
      isSavingPhotoRef.current = true;
      setIsSavingPhoto(true);
      try {
        await updateItem({ photos: updatedPhotos });
      } catch (err) {
        // Fire-and-forget caller (enhance/bg accept) — without this catch a
        // failed save is an unhandled rejection with zero user feedback.
        setUploadError(err instanceof Error ? err.message : "Failed to save edited photo");
        return;
      } finally {
        isSavingPhotoRef.current = false;
        setIsSavingPhoto(false);
        resetEnhance();
        resetBgRemoval();
      }
    },
    [item, photoIndex, applyToPhoto, updateItem, resetEnhance, resetBgRemoval],
  );

  // Rotate persists immediately (same UX as scan-flow): the server writes a
  // new R2 image, then the item's photo entry is updated via PATCH.
  const handleRotate = useCallback(async () => {
    const photo = photosRef.current[photoIndex];
    if (!token || isToolProcessing || !photo) return;
    setIsRotating(true);
    setUploadError(null);
    try {
      const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/rotate", {
        method: "POST",
        body: { imageUrl: photo.url, degrees: 90 },
        token,
      });
      const updatedPhotos = applyToPhoto(photo, photoIndex, {
        url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height,
      });
      if (!updatedPhotos) {
        setUploadError("Photo changed while editing — please retry.");
        return;
      }
      await updateItem({ photos: updatedPhotos });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setIsRotating(false);
    }
  }, [token, isRotating, isEnhancing, item, photoIndex, updateItem]);

  const handleCropApply = useCallback(
    async (crop: { x: number; y: number; width: number; height: number }) => {
      const photo = photosRef.current[photoIndex];
      if (!token || isSavingPhoto || !photo) return;
      setUploadError(null);
      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/crop", {
          method: "POST",
          body: { imageUrl: photo.url, crop },
          token,
        });
        const updatedPhotos = applyToPhoto(photo, photoIndex, {
          url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height,
        });
        if (!updatedPhotos) {
          setUploadError("Photo changed while editing — please retry.");
          return;
        }
        await updateItem({ photos: updatedPhotos });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Crop failed");
      } finally {
        setShowCrop(false);
      }
    },
    [token, item, photoIndex, applyToPhoto, updateItem],
  );

  const handleExposureApply = useCallback(
    async (ev: number) => {
      const photo = photosRef.current[photoIndex];
      if (!token || isSavingPhoto || !photo) return;
      setUploadError(null);
      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/exposure", {
          method: "POST",
          body: { imageUrl: photo.url, ev },
          token,
        });
        const updatedPhotos = applyToPhoto(photo, photoIndex, {
          url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height,
        });
        if (!updatedPhotos) {
          setUploadError("Photo changed while editing — please retry.");
          return;
        }
        await updateItem({ photos: updatedPhotos });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Exposure adjustment failed");
      } finally {
        setShowExposure(false);
      }
    },
    [token, item, photoIndex, applyToPhoto, updateItem],
  );

  const handleUseCompTitle = useCallback(
    async (comp: CompListing) => {
      if (!item) return;
      try {
        await updateItem({ title: comp.title });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to update title");
      }
    },
    [item, updateItem],
  );

  const handleUseCompCondition = useCallback(
    async (comp: CompListing) => {
      if (!item) return;
      try {
        const mapped = mapEbayCondition(comp.condition);
        await updateItem({ condition: mapped });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to update condition");
      }
    },
    [item, updateItem],
  );

  useEffect(() => {
    if (!isAuthenticated) router.replace("/inventory");
  }, [isAuthenticated, router]);

  if (!isAuthenticated || isLoading) {
    return (
      <div className={`${variant === "pane" ? "min-h-full" : "min-h-screen"} bg-background flex items-center justify-center`}>
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className={`${variant === "pane" ? "min-h-full" : "min-h-screen"} bg-background`}>
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center content-container">
            {variant === "page" && (
              <button onClick={() => onBack()} aria-label="Back" className="p-1 -ml-1 text-text-secondary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <span className="ml-3 text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Not Found</span>
          </div>
        </header>
        <div className="px-4 py-16 text-center content-container">
          <p className="text-text-secondary">{error ?? "Item not found"}</p>
          <button onClick={() => router.push("/inventory")} className="mt-4 text-sm text-forest-green font-medium">
            Back to inventory
          </button>
        </div>
      </div>
    );
  }

  // pendingPhotos first: the strip/sheet must render the optimistic order
  // DURING the drag, not after the PATCH round-trip.
  const photos = pendingPhotos ?? item.photos ?? [];
  const currentPhoto = photos[photoIndex];

  const valueDisplay = item.estimatedValueMin && item.estimatedValueMax
    ? `$${item.estimatedValueMin} – $${item.estimatedValueMax}`
    : item.estimatedValueRecommended
      ? `~$${item.estimatedValueRecommended}`
      : null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteItem();
      onDeleted();
    } catch (err) {
      // Keep the sheet open — closing silently reads as success.
      setIsDeleting(false);
      setDeleteError(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  // Editing routes to the canonical /edit page (eBay Taxonomy category + dynamic
  // conditions); the inline editor here was a stale duplicate with a deprecated
  // static category list that never persisted an eBay categoryId.
  const startEdit = () => router.push(`/inventory/${item.id}/edit`);

  return (
    <div className={`${variant === "pane" ? "min-h-full" : "min-h-screen"} bg-background`}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between content-container">
          <div className="flex items-center">
            {variant === "page" && (
              <button onClick={() => onBack()} aria-label="Back" className="p-1 -ml-1 text-text-secondary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <span className="ml-3 text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary truncate max-w-[200px]">
              {item.title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startEdit}
              aria-label="Edit item"
              className="p-2 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete"
              className="p-2 text-text-secondary hover:text-red-500 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="content-container">
        {/* Photo gallery strip — tap a thumb to open the editor overlay; the
            always-on hero + inline tools are gone (Stage 2.5 redesign). */}
        <div className="px-4 pt-3 space-y-2">
          <PhotoGalleryStrip
            photos={photos.map((p, i) => ({ key: p.key ?? `photo-${i}`, url: p.url }))}
            onEditPhoto={(i) => {
              setPhotoIndex(i);
              setEditingPhotoIndex(i);
            }}
            onAddPhotos={handleAddPhotos}
            maxPhotos={MAX_PHOTOS_PER_ITEM}
            onReorder={isToolProcessing ? undefined : handlePhotoReorder}
            onReorderEnd={handlePhotoReorderEnd}
            onDelete={isToolProcessing ? undefined : handlePhotoDelete}
          />
          {/* Buyer-eye share preview (listing-hub Task 5) */}
          <button
            onClick={() => router.push(`/inventory/${itemId}/preview`)}
            className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
          >
            Preview listing
          </button>
          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <div className="w-4 h-4 border-2 border-[var(--teal)] border-t-transparent rounded-full animate-spin" />
              Uploading...
            </div>
          )}
          {uploadError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
              {uploadError}
            </div>
          )}
          {enhanceError && (
            <div className="space-y-2">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
                {enhanceError}
              </div>
              <button onClick={resetEnhance} className="w-full py-2 rounded-xl border border-border text-sm text-text-primary">
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Photo editor overlay — all 5 tools wired (rotate/crop ported from
            scan-flow in S2.5-6; BG removal runs inline like enhance, no
            interstitial CTA). CropTool mounts in its own layer above the
            editor (z-[80]). */}
        {editingPhotoIndex !== null && currentPhoto && (
          showCrop ? (
            <CropTool
              imageUrl={currentPhoto.url}
              imageWidth={currentPhoto.width ?? 1024}
              imageHeight={currentPhoto.height ?? 1024}
              onApply={handleCropApply}
              onCancel={() => setShowCrop(false)}
            />
          ) : showExposure ? (
            <ExposureTool
              imageUrl={currentPhoto.url}
              onApply={handleExposureApply}
              onCancel={() => setShowExposure(false)}
            />
          ) : (
            <PhotoEditPanel
              photo={{ url: currentPhoto.url }}
              photoIndex={editingPhotoIndex}
              photoCount={photos.length}
              onClose={() => {
                if (enhanceResult) resetEnhance();
                if (bgResultUrl) resetBgRemoval();
                setEditingPhotoIndex(null);
              }}
              onRotate={handleRotate}
              onCrop={() => !isToolProcessing && setShowCrop(true)}
              onEnhance={() => enhance(currentPhoto.url)}
              onBgRemove={() => removeBackground(currentPhoto.url)}
              onExposure={() => !isToolProcessing && setShowExposure(true)}
              isProcessing={isToolProcessing}
              processingLabel={
                isRotating ? "Rotating..." : isEnhancing ? "Enhancing..." : isRemovingBg ? "Removing background..." : null
              }
              error={uploadError ?? enhanceError ?? bgError}
              pendingPreview={
                enhanceResult
                  ? {
                      beforeUrl: currentPhoto.url,
                      afterUrl: enhanceResult.image.url,
                      alt: item.title,
                      onAccept: () => handleSaveEditedPhoto(enhanceResult.image.url, enhanceResult.image.key),
                      onDiscard: resetEnhance,
                    }
                  : bgResultUrl
                  ? {
                      beforeUrl: currentPhoto.url,
                      afterUrl: bgResultUrl,
                      alt: item.title,
                      onAccept: () => handleSaveEditedPhoto(bgResultUrl, bgResultKey ?? undefined),
                      onDiscard: resetBgRemoval,
                    }
                  : null
              }
            />
          )
        )}

        {/* Item Info */}
        <div className="px-4 py-4 space-y-4 compact-bar-clearance">
            <>
              {/* Title + Value */}
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
                  {item.title}
                </h1>
                {valueDisplay && (
                  <span className="text-lg font-semibold text-forest-green whitespace-nowrap">
                    {valueDisplay}
                  </span>
                )}
              </div>

              {/* Condition + Category */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${conditionColors[item.condition] ?? "bg-muted text-text-secondary"}`}>
                  {formatCondition(item.condition)}
                </span>
                {item.category && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-text-secondary">
                    {item.category}
                  </span>
                )}
                {item.aiConfidenceScore > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-forest-green-50 text-forest-green">
                    AI {Math.round(item.aiConfidenceScore * 100)}%
                  </span>
                )}
              </div>

              {/* Description */}
              {item.description && (
                <div>
                  <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Description</h2>
                  <p className="text-sm text-text-primary leading-relaxed">{item.description}</p>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                {item.brand && (
                  <DetailField label="Brand" value={item.brand} />
                )}
                {item.model && (
                  <DetailField label="Model" value={item.model} />
                )}
                {item.conditionNotes && (
                  <div className="col-span-2">
                    <DetailField label="Condition Notes" value={item.conditionNotes} />
                  </div>
                )}
                <DetailField label="Quantity" value={String(item.quantity ?? 1)} />
              </div>
            </>

          {/* Features */}
          {item.features.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Features</h2>
              <div className="flex flex-wrap gap-1.5">
                {item.features.map((feature, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-muted rounded-lg text-xs text-text-primary"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Value Breakdown */}
          {item.estimatedValueMin && item.estimatedValueMax && (
            <div className="bg-forest-green-50 dark:bg-forest-green/10 rounded-xl p-4">
              <h2 className="text-xs font-medium text-forest-green uppercase tracking-wider mb-2">Estimated Value</h2>
              <div className="flex items-baseline gap-3">
                <div>
                  <span className="text-xs text-text-secondary">Low</span>
                  <p className="text-sm font-medium text-text-primary">${item.estimatedValueMin}</p>
                </div>
                <div className="flex-1 h-px bg-forest-green/20" />
                {item.estimatedValueRecommended && (
                  <>
                    <div className="text-center">
                      <span className="text-xs text-forest-green font-medium">Recommended</span>
                      <p className="text-lg font-semibold text-forest-green">${item.estimatedValueRecommended}</p>
                    </div>
                    <div className="flex-1 h-px bg-forest-green/20" />
                  </>
                )}
                <div>
                  <span className="text-xs text-text-secondary">High</span>
                  <p className="text-sm font-medium text-text-primary">${item.estimatedValueMax}</p>
                </div>
              </div>
            </div>
          )}

          {/* Marketplace Listings hub — HIGH placement (advisor review): live-listing
              state is first-screen adjacent, above the optimizer. Hidden when the
              item has no listings (the primary CTA below covers that case). */}
          {(itemListings.length > 0 || listingsError) && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold text-text-primary mb-2">Marketplace Listings</h2>
              {/* A failed fetch must not silently hide listing state (the
                  last-photo guard and the List CTA both depend on it). */}
              {listingsError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-2 mb-2">
                  <p className="text-sm text-red-700 dark:text-red-300">{listingsError}</p>
                  <button onClick={refetchListings} className="text-xs font-medium text-red-600 dark:text-red-400">
                    Try Again
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {visibleListings.map(renderListingCard)}
                {archivedListings.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowArchived((v) => !v)}
                      className="text-xs text-text-secondary font-medium py-1 text-left"
                    >
                      {showArchived ? "Hide archived" : `Show ${archivedListings.length} archived`}
                    </button>
                    {showArchived && archivedListings.map(renderListingCard)}
                  </>
                )}
              </div>
              {/* Demoted cross-list CTA — only marketplaces without a live/draft/sold
                  listing; the cards above are the duplicate-listing evidence. */}
              {availableMarketplaces.length > 0 && (
                <button
                  onClick={() => setShowListingSheet(true)}
                  className="w-full mt-2 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
                >
                  List on another marketplace — reach more buyers
                </button>
              )}
            </section>
          )}

          {/* Listing Optimizer — eBay item-specific gaps, demand, performance */}
          <ListingOptimizerPanel itemId={itemId} onFilled={refetchItem} />

          {/* List on Marketplace CTA — primary only when a SUCCESSFUL fetch
              says the item is unlisted. While loading (listings init to []) or
              after a fetch error, an existing listing would read as absent and
              invite a duplicate. */}
          {!listingsLoading && !listingsError && itemListings.length === 0 && (
            <button
              onClick={() => setShowListingSheet(true)}
              className="w-full py-3 rounded-xl bg-forest-green text-white text-sm font-semibold hover:bg-forest-green/90 transition-colors"
            >
              List on Marketplace
            </button>
          )}

          {/* Comparable Listings */}
          <div className="space-y-3">
            {compsLoading ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <div className="w-5 h-5 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-text-secondary">Searching eBay...</span>
              </div>
            ) : compsError && !comps ? (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-2">
                <p className="text-sm text-red-700 dark:text-red-300">{compsError}</p>
                <button onClick={fetchComps} className="text-xs font-medium text-red-600 dark:text-red-400">
                  Try Again
                </button>
              </div>
            ) : comps ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">eBay Comps</h2>
                  <button onClick={fetchComps} className="text-xs text-forest-green font-medium">
                    Refresh
                  </button>
                </div>

                {comps.partial && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Some eBay results could not be loaded</p>
                )}

                {comps.stats.sampleSize === 0 ? (
                  <p className="text-sm text-text-secondary py-3 text-center">No comparable listings found on eBay</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {comps.stats.soldAvg != null && (
                        <div className="bg-surface border border-border rounded-xl p-3 text-center">
                          <span className="text-xs text-text-secondary">Sold Avg</span>
                          <p className="text-lg font-semibold text-text-primary">${comps.stats.soldAvg.toFixed(0)}</p>
                          <span className="text-xs text-text-secondary">
                            median ${comps.stats.soldMedian?.toFixed(0)}
                          </span>
                        </div>
                      )}
                      {comps.stats.activeAvg != null && (
                        <div className="bg-surface border border-border rounded-xl p-3 text-center">
                          <span className="text-xs text-text-secondary">Active Avg</span>
                          <p className="text-lg font-semibold text-text-primary">${comps.stats.activeAvg.toFixed(0)}</p>
                          <span className="text-xs text-text-secondary">
                            median ${comps.stats.activeMedian?.toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {comps.sold.length > 0 && (
                      <CompSection
                        title="Recently Sold"
                        listings={comps.sold}
                        expandedUrl={expandedCompUrl}
                        onToggle={(url) => setExpandedCompUrl(expandedCompUrl === url ? null : url)}
                        onUseTitle={handleUseCompTitle}
                        onUseCondition={handleUseCompCondition}
                      />
                    )}
                    {comps.active.length > 0 && (
                      <CompSection
                        title="Active Listings"
                        listings={comps.active}
                        expandedUrl={expandedCompUrl}
                        onToggle={(url) => setExpandedCompUrl(expandedCompUrl === url ? null : url)}
                        onUseTitle={handleUseCompTitle}
                        onUseCondition={handleUseCompCondition}
                      />
                    )}
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={fetchComps}
                className="w-full py-3 rounded-xl border-2 border-dashed border-border text-sm font-medium text-text-secondary hover:border-forest-green hover:text-forest-green transition-colors"
              >
                Check eBay Comps
              </button>
            )}
          </div>

          {/* Timestamps */}
          <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-text-secondary">
            <span>Added {new Date(item.createdAt).toLocaleDateString()}</span>
            {item.updatedAt !== item.createdAt && (
              <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal — shared ConfirmSheet (dialog role, Escape,
          focus trap) instead of the raw modal it was extracted from. */}
      {showDeleteConfirm && (
        <ConfirmSheet
          title="Delete Item"
          body={`Are you sure you want to delete “${item.title}”? This action cannot be undone.`}
          confirmLabel="Delete"
          destructive
          busy={isDeleting}
          busyLabel="Deleting..."
          error={deleteError}
          onConfirm={handleDelete}
          onClose={() => {
            setDeleteError(null);
            setShowDeleteConfirm(false);
          }}
        />
      )}

      {/* Create Listing Sheet */}
      {showListingSheet && (
        <CreateListingSheet
          itemId={item.id}
          suggestedPrice={resolvePublishPriceWithSource(item, comps?.stats).price ?? undefined}
          priceSource={resolvePublishPriceWithSource(item, comps?.stats).source ?? undefined}
          allowedMarketplaces={itemListings.length > 0 ? availableMarketplaces : undefined}
          onCreated={() => {
            // Stay on the page — the new card appears in place (listing-hub Task 2).
            // The list-page usage of this sheet keeps its own redirect.
            setShowListingSheet(false);
            refetchListings();
          }}
          onClose={() => setShowListingSheet(false)}
        />
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</span>
      <p className="text-sm text-text-primary mt-0.5">{value}</p>
    </div>
  );
}

function mapEbayCondition(ebayCondition: string): "new" | "like_new" | "good" | "fair" | "poor" {
  const lower = ebayCondition.toLowerCase();
  if (lower.includes("new") && !lower.includes("pre") && !lower.includes("open")) return "new";
  if (lower.includes("like new") || lower.includes("open box") || lower.includes("refurbished")) return "like_new";
  if (lower.includes("very good") || lower.includes("good") || lower.includes("pre-owned")) return "good";
  if (lower.includes("acceptable") || lower.includes("fair")) return "fair";
  if (lower.includes("parts") || lower.includes("poor")) return "poor";
  return "good";
}

function CompSection({
  title,
  listings,
  expandedUrl,
  onToggle,
  onUseTitle,
  onUseCondition,
}: {
  title: string;
  listings: CompListing[];
  expandedUrl: string | null;
  onToggle: (url: string) => void;
  onUseTitle: (comp: CompListing) => void;
  onUseCondition: (comp: CompListing) => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-text-secondary mb-2">{title}</h3>
      <div className="space-y-2">
        {listings.map((comp) => {
          const isExpanded = expandedUrl === comp.listingUrl;
          return (
            <div
              key={comp.listingUrl}
              className="bg-surface border border-border rounded-xl overflow-hidden transition-colors"
            >
              <button
                onClick={() => onToggle(comp.listingUrl)}
                className="w-full flex items-center gap-3 p-2.5 text-left"
              >
                {comp.imageUrl ? (
                  <img src={comp.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{comp.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-secondary">{comp.condition}</span>
                    {comp.soldDate && (
                      <span className="text-xs text-text-secondary">
                        {new Date(comp.soldDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-forest-green flex-shrink-0">
                  ${comp.price.toFixed(0)}
                </span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className={`flex-shrink-0 text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUseTitle(comp)}
                      className="flex-1 py-2 rounded-lg bg-forest-green-50 text-forest-green text-xs font-medium hover:bg-forest-green-100 transition-colors"
                    >
                      Use Title
                    </button>
                    <button
                      onClick={() => onUseCondition(comp)}
                      className="flex-1 py-2 rounded-lg bg-forest-green-50 text-forest-green text-xs font-medium hover:bg-forest-green-100 transition-colors"
                    >
                      Use Condition
                    </button>
                  </div>
                  <a
                    href={comp.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center py-2 rounded-lg border border-border text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    View on eBay
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
