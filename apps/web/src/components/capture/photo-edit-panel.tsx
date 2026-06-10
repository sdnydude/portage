"use client";

import { BeforeAfterSlider } from "@/components/image/before-after-slider";

interface PendingPreview {
  beforeUrl: string;
  afterUrl: string;
  alt: string;
  onAccept: () => void;
  onDiscard: () => void;
}

interface PhotoEditPanelProps {
  photo: { url: string };
  photoIndex: number;
  photoCount: number;
  onClose: () => void;
  onRotate: () => void;
  onCrop: () => void;
  onEnhance: () => void;
  onBgRemove: () => void;
  isProcessing: boolean;
  processingLabel: string | null;
  pendingPreview: PendingPreview | null;
}

/**
 * Full-screen photo editor overlay per the approved comp (EDITOR screen):
 * dark stage with the photo centered, glass toolbar hosting all 4 tools.
 * Generalizes the old activeTool==='crop' takeover pattern — tool state and
 * handlers stay in the host (scan-flow / item detail); this is presentational.
 * Crop itself still mounts CropTool above this panel (z-[80]).
 */
export function PhotoEditPanel({
  photo,
  photoIndex,
  photoCount,
  onClose,
  onRotate,
  onCrop,
  onEnhance,
  onBgRemove,
  isProcessing,
  processingLabel,
  pendingPreview,
}: PhotoEditPanelProps) {
  const tools = [
    { label: "Rotate", onClick: onRotate },
    { label: "Crop", onClick: onCrop },
    { label: "Enhance", onClick: onEnhance },
    { label: "BG Remove", onClick: onBgRemove },
  ] as const;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#15181b] text-white animate-slide-up-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2.5">
        <span className="font-[family-name:var(--font-instrument)] font-semibold text-[17px]">
          Edit photo {photoIndex + 1} of {photoCount}
        </span>
        <button
          onClick={onClose}
          aria-label="Close editor"
          className="w-10 h-10 rounded-full grid place-items-center bg-white/10 text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stage — pending preview takes over the photo area when present */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-2 relative">
        {pendingPreview ? (
          <div className="w-72 max-w-full">
            <BeforeAfterSlider
              beforeUrl={pendingPreview.beforeUrl}
              afterUrl={pendingPreview.afterUrl}
              alt={pendingPreview.alt}
            />
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo.url}
            alt={`Photo ${photoIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-[22px]"
          />
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
            {processingLabel && <p className="text-white text-sm mt-3 font-medium">{processingLabel}</p>}
          </div>
        )}
      </div>

      {pendingPreview ? (
        /* Accept / discard replaces the toolbar while a result is pending */
        <div
          className="mx-4 mb-5 flex gap-3"
          style={{ marginBottom: "calc(1.25rem + var(--safe-area-bottom))" }}
        >
          <button
            onClick={pendingPreview.onDiscard}
            className="flex-1 py-3 rounded-xl border border-white/30 text-white text-sm font-medium"
          >
            Discard
          </button>
          <button
            onClick={pendingPreview.onAccept}
            className="flex-1 py-3 rounded-xl bg-[var(--orange)] text-white text-sm font-semibold"
          >
            Use this photo
          </button>
        </div>
      ) : (
        /* Glass toolbar — the 4 tools */
        <div
          className="mx-4 mb-5 px-2.5 py-3.5 rounded-[22px] flex justify-around bg-white/10 border border-white/15 backdrop-blur-xl"
          style={{ marginBottom: "calc(1.25rem + var(--safe-area-bottom))" }}
        >
          {tools.map(tool => (
            <button
              key={tool.label}
              onClick={tool.onClick}
              disabled={isProcessing}
              className="flex flex-col items-center gap-1.5 min-w-[60px] min-h-[60px] justify-center disabled:opacity-50"
            >
              <span className="w-[46px] h-[46px] rounded-[15px] grid place-items-center bg-white/10 border border-white/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" opacity="0.35" />
                </svg>
              </span>
              <span className="text-[11px] font-semibold">{tool.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
