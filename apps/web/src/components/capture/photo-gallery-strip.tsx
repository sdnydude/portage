"use client";

import { useRef, useState } from "react";
import { usePhotoDrag } from "@/hooks/use-photo-drag";
import { CaptureSheet } from "./capture-sheet";
import { PhotoManageSheet } from "./photo-manage-sheet";

interface StripPhoto {
  key?: string;
  url: string;
  /** False while a photo can't be edited yet (e.g. a local blob: still
   *  uploading) — the thumb renders without the edit affordance. */
  editable?: boolean;
}

interface PhotoGalleryStripProps {
  photos: StripPhoto[];
  onEditPhoto: (index: number) => void;
  /** Omit in hosts that have no photo-upload path — the add tile is hidden. */
  onAddPhotos?: (files: File[]) => void;
  maxPhotos: number;
  /** Live reorder during a long-press drag. Omit in read-only hosts — thumbs
   *  stay tap-to-edit only. */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** Fires once when a drag that moved something ends — the persist point. */
  onReorderEnd?: () => void;
  /** Delete a photo — surfaced inside the manage sheet, not on strip thumbs
   *  (78px thumbs + accidental taps don't mix). */
  onDelete?: (index: number) => void;
}

/**
 * Compact gallery strip per the approved scan-review redesign comp (PHOTO
 * GALLERY SELECTOR): photo count label, COVER tag on the hero photo,
 * per-thumb edit affordance. Tapping a thumb opens the full-screen editor —
 * there is no always-on inline editor anymore. Hosts that pass onReorder get
 * long-press drag reordering (touch-capable via use-photo-drag).
 */
export function PhotoGalleryStrip({ photos, onEditPhoto, onAddPhotos, maxPhotos, onReorder, onReorderEnd, onDelete }: PhotoGalleryStripProps) {
  // Set when a gesture reordered something; swallows the browser's trailing
  // click on the origin thumb so a completed drag doesn't pop the editor.
  const didDragRef = useRef(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { dragIndex, getItemProps } = usePhotoDrag({
    onMove: (from, to) => {
      didDragRef.current = true;
      onReorder?.(from, to);
    },
    onDrop: () => onReorderEnd?.(),
    disabled: (i) => photos[i]?.editable === false,
  });

  const dragEnabled = Boolean(onReorder);

  return (
    <div className="rounded-2xl bg-surface border border-border p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        {dragEnabled ? (
          <button
            aria-label="Manage photos"
            onClick={() => setManageOpen(true)}
            className="font-[family-name:var(--font-jetbrains)] text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary underline decoration-dotted underline-offset-2"
          >
            Photos · {photos.length}
          </button>
        ) : (
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
            Photos · {photos.length}
          </span>
        )}
        <span className="text-[11px] font-semibold text-[var(--orange)]">Tap to edit</span>
      </div>

      {/* Camera + gallery chooser — beta report 6337abaf: the bare file
          picker offered no camera on desktop, and none at all outside the
          scan flow. CaptureSheet is the same chooser the scan entry uses. */}
      {addOpen && onAddPhotos && (
        <CaptureSheet
          onFiles={onAddPhotos}
          onClose={() => setAddOpen(false)}
        />
      )}

      {manageOpen && (
        <PhotoManageSheet
          photos={photos}
          onClose={() => setManageOpen(false)}
          onReorder={(from, to) => onReorder?.(from, to)}
          onReorderEnd={onReorderEnd}
          onDelete={onDelete}
        />
      )}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {photos.map((photo, i) => {
          const editable = photo.editable !== false;
          const thumbClass = `photo-drag-tile relative flex-shrink-0 w-[78px] h-[78px] rounded-[15px] overflow-hidden border-2 ${
            i === 0 ? "border-[var(--teal)]" : "border-transparent"
          }`;
          const dragStyle = dragIndex === i ? { opacity: 0.5, transform: "scale(0.95)" } : undefined;
          const contents = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {i === 0 && (
                <span className="absolute top-1 left-1 font-[family-name:var(--font-jetbrains)] text-[8px] font-bold tracking-wide px-1.5 py-0.5 rounded-[5px] bg-[var(--teal)] text-white">
                  COVER
                </span>
              )}
              {editable && (
                <span data-testid="edit-dot" className="absolute right-1 bottom-1 w-[22px] h-[22px] rounded-full bg-black/60 backdrop-blur-sm border border-white/25 grid place-items-center text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </span>
              )}
            </>
          );
          return editable ? (
            <button
              key={photo.key ?? photo.url}
              onClick={() => {
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                onEditPhoto(i);
              }}
              aria-label={`Edit photo ${i + 1}`}
              className={`${thumbClass} transition-transform active:scale-95`}
              style={dragStyle}
              {...(dragEnabled ? getItemProps(i) : {})}
            >
              {contents}
            </button>
          ) : (
            <div
              key={photo.key ?? photo.url}
              className={thumbClass}
              style={dragStyle}
              {...(dragEnabled ? getItemProps(i) : {})}
            >
              {contents}
            </div>
          );
        })}

        {onAddPhotos && photos.length < maxPhotos && (
          <button
            aria-label="Add photos"
            onClick={() => setAddOpen(true)}
            className="flex-shrink-0 w-[78px] h-[78px] rounded-[15px] border-2 border-dashed border-border bg-muted grid place-items-center text-text-secondary cursor-pointer hover:text-[var(--teal)] hover:border-[var(--teal)] transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
