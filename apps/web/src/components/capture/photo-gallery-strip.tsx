"use client";

import { ImagePicker } from "./image-picker";

interface StripPhoto {
  key: string;
  url: string;
}

interface PhotoGalleryStripProps {
  photos: StripPhoto[];
  onEditPhoto: (index: number) => void;
  onAddPhotos: (files: File[]) => void;
  maxPhotos: number;
}

/**
 * Compact gallery strip per the approved scan-review redesign comp (PHOTO
 * GALLERY SELECTOR): photo count label, COVER tag on the hero photo,
 * per-thumb edit affordance. Tapping a thumb opens the full-screen editor —
 * there is no always-on inline editor anymore.
 */
export function PhotoGalleryStrip({ photos, onEditPhoto, onAddPhotos, maxPhotos }: PhotoGalleryStripProps) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
          Photos · {photos.length}
        </span>
        <span className="text-[11px] font-semibold text-[var(--orange)]">Tap to edit</span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {photos.map((photo, i) => (
          <button
            key={photo.key}
            onClick={() => onEditPhoto(i)}
            aria-label={`Edit photo ${i + 1}`}
            className={`relative flex-shrink-0 w-[78px] h-[78px] rounded-[15px] overflow-hidden border-2 transition-transform active:scale-95 ${
              i === 0 ? "border-[var(--teal)]" : "border-transparent"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1 left-1 font-[family-name:var(--font-jetbrains)] text-[8px] font-bold tracking-wide px-1.5 py-0.5 rounded-[5px] bg-[var(--teal)] text-white">
                COVER
              </span>
            )}
            <span data-testid="edit-dot" className="absolute right-1 bottom-1 w-[22px] h-[22px] rounded-full bg-black/60 backdrop-blur-sm border border-white/25 grid place-items-center text-white">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </span>
          </button>
        ))}

        {photos.length < maxPhotos && (
          <ImagePicker onSelect={onAddPhotos} multiple>
            <div
              aria-label="Add photos"
              className="flex-shrink-0 w-[78px] h-[78px] rounded-[15px] border-2 border-dashed border-border bg-muted grid place-items-center text-text-secondary cursor-pointer hover:text-[var(--teal)] hover:border-[var(--teal)] transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
          </ImagePicker>
        )}
      </div>
    </div>
  );
}
