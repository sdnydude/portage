"use client";

import { usePhotoDrag } from "@/hooks/use-photo-drag";

interface SheetPhoto {
  key?: string;
  url: string;
  editable?: boolean;
}

interface PhotoManageSheetProps {
  photos: SheetPhoto[];
  onClose: () => void;
  /** Live reorder during a long-press drag. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Fires once when a drag that moved something ends — the persist point. */
  onReorderEnd?: () => void;
  onDelete?: (index: number) => void;
}

/**
 * Full-screen photo management sheet: 3-column grid scaled for the 24-photo
 * cap, long-press drag reorder (use-photo-drag), per-tile delete. Opened from
 * the PhotoGalleryStrip header; visual shell mirrors PhotoEditPanel
 * (fixed inset-0 z-[70], dark, slide-up-full, safe-area footer).
 */
export function PhotoManageSheet({ photos, onClose, onReorder, onReorderEnd, onDelete }: PhotoManageSheetProps) {
  const { dragIndex, getItemProps } = usePhotoDrag({
    onMove: onReorder,
    onDrop: onReorderEnd,
    disabled: (i) => photos[i]?.editable === false,
  });

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#15181b] text-white animate-slide-up-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="font-[family-name:var(--font-jetbrains)] text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
          Photos · {photos.length}
        </span>
        <span className="text-[11px] text-white/45">Hold & drag to reorder</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div
              key={photo.key ?? photo.url}
              className="relative aspect-square rounded-xl overflow-hidden"
              style={dragIndex === i ? { opacity: 0.5, transform: "scale(0.95)" } : undefined}
              {...getItemProps(i)}
            >
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
              {onDelete && (
                <button
                  data-photo-drag-ignore
                  aria-label={`Delete photo ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <span className="text-white text-xs">✕</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4" style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom, 0px))" }}>
        <button
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-white text-black font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}
