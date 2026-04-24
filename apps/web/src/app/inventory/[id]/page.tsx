"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useItem } from "@/hooks/use-item";
import { useAuth } from "@/hooks/use-auth";
import { BgRemovalPanel } from "@/components/image/bg-removal-panel";
import { useEnhance } from "@/hooks/use-enhance";
import { BeforeAfterSlider } from "@/components/image/before-after-slider";
import { CreateListingSheet } from "@/components/listing/create-listing-sheet";

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

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
  const { isAuthenticated } = useAuth();
  const { item, isLoading, error, deleteItem } = useItem(params.id);
  const { isProcessing: isEnhancing, result: enhanceResult, error: enhanceError, enhance, reset: resetEnhance } = useEnhance();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const [showListingSheet, setShowListingSheet] = useState(false);

  if (!isAuthenticated) {
    router.replace("/inventory");
    return null;
  }

  if (isLoading) {
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

  const handlePrevPhoto = () => setPhotoIndex((i) => Math.max(0, i - 1));
  const handleNextPhoto = () => setPhotoIndex((i) => Math.min(photos.length - 1, i + 1));

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
              onClick={() => router.push(`/inventory/${item.id}/edit`)}
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
        {/* Photo Gallery */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {currentPhoto ? (
            <img src={currentPhoto.url} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}

          {photos.length > 1 && (
            <>
              {photoIndex > 0 && (
                <button
                  onClick={handlePrevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              )}
              {photoIndex < photos.length - 1 && (
                <button
                  onClick={handleNextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === photoIndex ? "bg-white" : "bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Photo Tools */}
        {currentPhoto && (
          <div className="px-4 pt-3 space-y-3">
            {showBgRemoval ? (
              <BgRemovalPanel
                imageUrl={currentPhoto.url}
                alt={item.title}
                onClose={() => setShowBgRemoval(false)}
              />
            ) : enhanceResult ? (
              <div className="space-y-3">
                <BeforeAfterSlider
                  beforeUrl={currentPhoto.url}
                  afterUrl={enhanceResult.image.url}
                  alt={item.title}
                />
                <div className="flex gap-3">
                  <button
                    onClick={resetEnhance}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : enhanceError ? (
              <div className="space-y-2">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
                  {enhanceError}
                </div>
                <button onClick={resetEnhance} className="w-full py-2 rounded-xl border border-border text-sm text-text-primary">
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBgRemoval(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-forest-green-50 text-forest-green text-sm font-medium hover:bg-forest-green-100 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 3a6 6 0 016 6c0 7-3 9-6 9s-6-2-6-9a6 6 0 016-6z" />
                    <path d="M6 21h12" />
                  </svg>
                  Remove BG
                </button>
                <button
                  onClick={() => enhance(currentPhoto.url)}
                  disabled={isEnhancing}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-forest-green-50 text-forest-green text-sm font-medium hover:bg-forest-green-100 transition-colors disabled:opacity-50"
                >
                  {isEnhancing ? (
                    <div className="w-4 h-4 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  )}
                  {isEnhancing ? "Enhancing..." : "Auto-Enhance"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Item Info */}
        <div className="px-4 py-4 space-y-4">
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
              {conditionLabels[item.condition] ?? item.condition}
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
          </div>

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
          suggestedPrice={item.estimatedValueRecommended ?? undefined}
          onCreated={() => {
            setShowListingSheet(false);
            router.push("/listings");
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
