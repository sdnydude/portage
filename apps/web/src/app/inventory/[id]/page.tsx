"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useItem } from "@/hooks/use-item";
import { useAuth } from "@/hooks/use-auth";
import { BgRemovalPanel } from "@/components/image/bg-removal-panel";
import { useEnhance } from "@/hooks/use-enhance";
import { PhotoGalleryStrip } from "@/components/capture/photo-gallery-strip";
import { PhotoEditPanel } from "@/components/capture/photo-edit-panel";
import { CreateListingSheet } from "@/components/listing/create-listing-sheet";
import { CropTool } from "@/components/listing-flow/crop-tool";
import { useComps } from "@/hooks/use-comps";
import { api, API_BASE } from "@/lib/api";
import type { CompListing } from "@portage/shared";
import { formatCondition } from "@/lib/format";
import { resolvePublishPrice } from "@/lib/price";

const conditionColors: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  like_new: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  good: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  fair: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  poor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, token } = useAuth();
  const { item, isLoading, error, deleteItem, updateItem } = useItem(params.id);
  const { isProcessing: isEnhancing, result: enhanceResult, error: enhanceError, enhance, reset: resetEnhance } = useEnhance();
  const [photoIndex, setPhotoIndex] = useState(0);
  // Which photo the full-screen editor overlay is open for (null = closed).
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [showListingSheet, setShowListingSheet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedCompUrl, setExpandedCompUrl] = useState<string | null>(null);
  const { comps, isLoading: compsLoading, error: compsError, fetchComps } = useComps(params.id);

  const handleAddPhotos = useCallback(
    async (files: File[]) => {
      if (!token || !item) return;
      setIsUploading(true);
      setUploadError(null);

      try {
        const newPhotos = [];
        let failCount = 0;
        for (const file of files) {
          const formData = new FormData();
          formData.append("image", file);
          try {
            const res = await fetch(`${API_BASE}/images`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });
            if (!res.ok) { failCount++; continue; }
            const data = await res.json();
            newPhotos.push({
              url: data.image.url,
              key: data.image.key,
              width: data.image.width,
              height: data.image.height,
              isPrimary: false,
            });
          } catch {
            failCount++;
          }
        }

        if (newPhotos.length > 0) {
          const updatedPhotos = [...(item.photos ?? []), ...newPhotos];
          await updateItem({ photos: updatedPhotos });
        }

        if (failCount > 0 && newPhotos.length === 0) {
          setUploadError("All photos failed to upload. Please try again.");
        } else if (failCount > 0) {
          setUploadError(`${failCount} photo(s) failed to upload and were skipped.`);
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
      if (!item) return;
      const itemPhotos = item.photos ?? [];
      if (!itemPhotos[photoIndex]) return;
      const updatedPhotos = itemPhotos.map((p, i) =>
        i === photoIndex
          ? { ...p, url: newUrl, ...(newKey ? { key: newKey } : {}) }
          : p
      );
      await updateItem({ photos: updatedPhotos });
      resetEnhance();
      setShowBgRemoval(false);
    },
    [item, photoIndex, updateItem, resetEnhance],
  );

  // Rotate persists immediately (same UX as scan-flow): the server writes a
  // new R2 image, then the item's photo entry is updated via PATCH.
  const handleRotate = useCallback(async () => {
    const itemPhotos = item?.photos ?? [];
    const photo = itemPhotos[photoIndex];
    if (!token || isRotating || isEnhancing || !photo) return;
    setIsRotating(true);
    setUploadError(null);
    try {
      const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/rotate", {
        method: "POST",
        body: { imageUrl: photo.url, degrees: 90 },
        token,
      });
      const updatedPhotos = itemPhotos.map((p, i) =>
        i === photoIndex
          ? { ...p, url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height }
          : p
      );
      await updateItem({ photos: updatedPhotos });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setIsRotating(false);
    }
  }, [token, isRotating, isEnhancing, item, photoIndex, updateItem]);

  const handleCropApply = useCallback(
    async (crop: { x: number; y: number; width: number; height: number }) => {
      const itemPhotos = item?.photos ?? [];
      const photo = itemPhotos[photoIndex];
      if (!token || !photo) return;
      setUploadError(null);
      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/crop", {
          method: "POST",
          body: { imageUrl: photo.url, crop },
          token,
        });
        const updatedPhotos = itemPhotos.map((p, i) =>
          i === photoIndex
            ? { ...p, url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height }
            : p
        );
        await updateItem({ photos: updatedPhotos });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Crop failed");
      } finally {
        setShowCrop(false);
      }
    },
    [token, item, photoIndex, updateItem],
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !item) {
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
          <p className="text-text-secondary">{error ?? "Item not found"}</p>
          <button onClick={() => router.push("/inventory")} className="mt-4 text-sm text-forest-green font-medium">
            Back to inventory
          </button>
        </div>
      </div>
    );
  }

  const photos = item.photos ?? [];
  const currentPhoto = photos[photoIndex];

  const valueDisplay = item.estimatedValueMin && item.estimatedValueMax
    ? `$${item.estimatedValueMin} – $${item.estimatedValueMax}`
    : item.estimatedValueRecommended
      ? `~$${item.estimatedValueRecommended}`
      : null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteItem();
      router.replace("/inventory");
    } catch {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Editing routes to the canonical /edit page (eBay Taxonomy category + dynamic
  // conditions); the inline editor here was a stale duplicate with a deprecated
  // static category list that never persisted an eBay categoryId.
  const startEdit = () => router.push(`/inventory/${item.id}/edit`);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-1 -ml-1 text-text-secondary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
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

      <div className="max-w-lg mx-auto">
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
            maxPhotos={12}
          />
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

        {/* Photo editor overlay — all 4 tools wired (rotate/crop ported from
            scan-flow in S2.5-6). CropTool and the BG-removal panel each mount
            in their own layer above the editor (z-[80]). */}
        {editingPhotoIndex !== null && currentPhoto && (
          showCrop ? (
            <CropTool
              imageUrl={currentPhoto.url}
              imageWidth={currentPhoto.width ?? 1024}
              imageHeight={currentPhoto.height ?? 1024}
              onApply={handleCropApply}
              onCancel={() => setShowCrop(false)}
            />
          ) : showBgRemoval ? (
            <div className="fixed inset-0 z-[80] bg-background overflow-y-auto">
              <div className="max-w-lg mx-auto p-4">
                <BgRemovalPanel
                  imageUrl={currentPhoto.url}
                  alt={item.title}
                  onSave={(url) => {
                    handleSaveEditedPhoto(url);
                    setShowBgRemoval(false);
                  }}
                  onClose={() => setShowBgRemoval(false)}
                />
              </div>
            </div>
          ) : (
            <PhotoEditPanel
              photo={{ url: currentPhoto.url }}
              photoIndex={editingPhotoIndex}
              photoCount={photos.length}
              onClose={() => {
                if (enhanceResult) resetEnhance();
                setEditingPhotoIndex(null);
              }}
              onRotate={handleRotate}
              onCrop={() => !isRotating && !isEnhancing && setShowCrop(true)}
              onEnhance={() => enhance(currentPhoto.url)}
              onBgRemove={() => setShowBgRemoval(true)}
              isProcessing={isEnhancing || isRotating}
              processingLabel={isRotating ? "Rotating..." : isEnhancing ? "Enhancing..." : null}
              error={uploadError ?? enhanceError}
              pendingPreview={
                enhanceResult
                  ? {
                      beforeUrl: currentPhoto.url,
                      afterUrl: enhanceResult.image.url,
                      alt: item.title,
                      onAccept: () => handleSaveEditedPhoto(enhanceResult.image.url, enhanceResult.image.key),
                      onDiscard: resetEnhance,
                    }
                  : null
              }
            />
          )
        )}

        {/* Item Info */}
        <div className="px-4 py-4 space-y-4">
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

          {/* List on Marketplace CTA */}
          <button
            onClick={() => setShowListingSheet(true)}
            className="w-full py-3 rounded-xl bg-forest-green text-white text-sm font-semibold hover:bg-forest-green/90 transition-colors"
          >
            List on Marketplace
          </button>

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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 mb-0 sm:mb-0 p-6 space-y-4">
            <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
              Delete Item
            </h3>
            <p className="text-sm text-text-secondary">
              Are you sure you want to delete &ldquo;{item.title}&rdquo;? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-medium text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Listing Sheet */}
      {showListingSheet && (
        <CreateListingSheet
          itemId={item.id}
          suggestedPrice={resolvePublishPrice(item, comps?.stats) ?? undefined}
          onCreated={() => {
            setShowListingSheet(false);
            // Save-redirect contract: land on inventory, not listings
            router.push("/inventory");
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
