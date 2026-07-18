"use client";

import { BeforeAfterSlider } from "@/components/image/before-after-slider";

// Tool icons (moved from scan-flow's retired inline toolbar).
function RotateIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
    </svg>
  );
}

function EnhanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function BgRemoveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="12" cy="12" r="5" />
      <line x1="3" y1="3" x2="7" y2="7" />
      <line x1="17" y1="17" x2="21" y2="21" />
    </svg>
  );
}

function ExposureIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="7" y2="7" />
      <line x1="17" y1="17" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="7" y2="17" />
      <line x1="17" y1="7" x2="19.1" y2="4.9" />
    </svg>
  );
}

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
  /** Omit to suppress this tool in the toolbar (all current hosts wire all four). */
  onRotate?: () => void;
  onCrop?: () => void;
  onEnhance: () => void;
  onBgRemove: () => void;
  onExposure?: () => void;
  isProcessing: boolean;
  processingLabel: string | null;
  pendingPreview: PendingPreview | null;
  /** Tool failure to surface inside the overlay — page-level error displays
   *  are hidden underneath this fixed layer. */
  error?: string | null;
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
  onExposure,
  isProcessing,
  processingLabel,
  pendingPreview,
  error,
}: PhotoEditPanelProps) {
  const tools = [
    { label: "Rotate", testId: "tool-icon-rotate", icon: <RotateIcon />, onClick: onRotate },
    { label: "Crop", testId: "tool-icon-crop", icon: <CropIcon />, onClick: onCrop },
    { label: "Exposure", testId: "tool-icon-exposure", icon: <ExposureIcon />, onClick: onExposure },
    { label: "Enhance", testId: "tool-icon-enhance", icon: <EnhanceIcon />, onClick: onEnhance },
    { label: "BG Remove", testId: "tool-icon-bg-remove", icon: <BgRemoveIcon />, onClick: onBgRemove },
  ].filter((t): t is typeof t & { onClick: () => void } => t.onClick !== undefined);

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
          disabled={isProcessing}
          className="w-10 h-10 rounded-full grid place-items-center bg-white/10 text-white disabled:opacity-40"
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

      {error && (
        <div className="mx-4 mb-2 rounded-xl bg-red-500/20 border border-red-400/40 px-4 py-2.5 text-sm text-red-200 text-center">
          {error}
        </div>
      )}

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
              <span data-testid={tool.testId} className="w-[46px] h-[46px] rounded-[15px] grid place-items-center bg-white/10 border border-white/10">
                {tool.icon}
              </span>
              <span className="text-[11px] font-semibold">{tool.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
