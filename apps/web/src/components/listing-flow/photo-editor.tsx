"use client";

import { useState, useCallback, useEffect } from "react";
import { useEnhance } from "@/hooks/use-enhance";
import { useBgRemoval } from "@/hooks/use-bg-removal";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
import { CropTool } from "./crop-tool";
import { BeforeAfterSlider } from "@/components/image/before-after-slider";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

interface PhotoEditorProps {
  photo: CapturedPhoto;
  onSave: (updated: CapturedPhoto) => void;
  onCancel: () => void;
}

type ActiveTool = "none" | "crop";

interface RotateResponse {
  image: { key: string; url: string; width: number; height: number };
}

interface CropResponse {
  image: { key: string; url: string; width: number; height: number };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function RotateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
    </svg>
  );
}

function EnhanceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function BgRemoveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="12" cy="12" r="5" />
      <line x1="3" y1="3" x2="7" y2="7" />
      <line x1="17" y1="17" x2="21" y2="21" />
      <line x1="21" y1="3" x2="17" y2="7" />
      <line x1="3" y1="21" x2="7" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function Spinner({ size = 32, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: "spin 0.75s linear infinite" }}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PhotoEditor({ photo, onSave, onCancel }: PhotoEditorProps) {
  const { token } = useAuth();
  const {
    isProcessing: isEnhancing,
    result: enhanceResult,
    error: enhanceError,
    enhance,
    reset: resetEnhance,
  } = useEnhance();
  const {
    isProcessing: isRemovingBg,
    resultUrl: bgResultUrl,
    error: bgError,
    removeBackground,
    reset: resetBgRemoval,
  } = useBgRemoval();

  const [currentPhoto, setCurrentPhoto] = useState<CapturedPhoto>(photo);
  const [activeTool, setActiveTool] = useState<ActiveTool>("none");
  const [isRotating, setIsRotating] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"enhance" | "bg" | null>(null);

  const isProcessing = isRotating || isCropping || isEnhancing || isRemovingBg;

  // Show enhance error
  useEffect(() => {
    if (enhanceError) {
      setError(enhanceError);
      resetEnhance();
      setPreviewMode(null);
    }
  }, [enhanceError, resetEnhance]);

  // Show bg removal error
  useEffect(() => {
    if (bgError) {
      setError(bgError);
      resetBgRemoval();
      setPreviewMode(null);
    }
  }, [bgError, resetBgRemoval]);

  const handleAcceptEnhance = useCallback(() => {
    if (!enhanceResult) return;
    setCurrentPhoto((prev) => ({
      ...prev,
      url: enhanceResult.image.url,
      key: enhanceResult.image.key,
      width: enhanceResult.image.width,
      height: enhanceResult.image.height,
    }));
    resetEnhance();
    setPreviewMode(null);
  }, [enhanceResult, resetEnhance]);

  const handleDiscardEnhance = useCallback(() => {
    resetEnhance();
    setPreviewMode(null);
  }, [resetEnhance]);

  const handleAcceptBg = useCallback(() => {
    if (!bgResultUrl) return;
    setCurrentPhoto((prev) => ({
      ...prev,
      url: bgResultUrl,
    }));
    resetBgRemoval();
    setPreviewMode(null);
  }, [bgResultUrl, resetBgRemoval]);

  const handleDiscardBg = useCallback(() => {
    resetBgRemoval();
    setPreviewMode(null);
  }, [resetBgRemoval]);

  // Inject spinner keyframe once
  useEffect(() => {
    const id = "photo-editor-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  // ─── Rotate ─────────────────────────────────────────────────────────────────

  const handleRotate = useCallback(async () => {
    if (!token || isProcessing) return;
    setIsRotating(true);
    setError(null);

    try {
      const data = await api<RotateResponse>("/images/rotate", {
        method: "POST",
        body: { imageUrl: currentPhoto.url, degrees: 90 },
        token,
      });
      setCurrentPhoto((prev) => ({
        ...prev,
        url: data.image.url,
        key: data.image.key,
        width: data.image.width,
        height: data.image.height,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rotation failed");
    } finally {
      setIsRotating(false);
    }
  }, [token, isProcessing, currentPhoto.url]);

  // ─── Crop ───────────────────────────────────────────────────────────────────

  const handleOpenCrop = useCallback(() => {
    if (isProcessing) return;
    setActiveTool("crop");
  }, [isProcessing]);

  const handleCropApply = useCallback(
    async (crop: { x: number; y: number; width: number; height: number }) => {
      if (!token) return;
      setIsCropping(true);
      setError(null);

      try {
        const data = await api<CropResponse>("/images/crop", {
          method: "POST",
          body: { imageUrl: currentPhoto.url, crop },
          token,
        });
        setCurrentPhoto((prev) => ({
          ...prev,
          url: data.image.url,
          key: data.image.key,
          width: data.image.width,
          height: data.image.height,
        }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Crop failed");
      } finally {
        setIsCropping(false);
        setActiveTool("none");
      }
    },
    [token, currentPhoto.url],
  );

  const handleCropCancel = useCallback(() => {
    setActiveTool("none");
  }, []);

  // ─── Enhance ────────────────────────────────────────────────────────────────

  const handleEnhance = useCallback(() => {
    if (isProcessing) return;
    setError(null);
    setPreviewMode("enhance");
    enhance(currentPhoto.url);
  }, [isProcessing, enhance, currentPhoto.url]);

  // ─── BG Remove ──────────────────────────────────────────────────────────────

  const handleBgRemove = useCallback(() => {
    if (isProcessing) return;
    setError(null);
    setPreviewMode("bg");
    removeBackground(currentPhoto.url);
  }, [isProcessing, removeBackground, currentPhoto.url]);

  // ─── Save / Cancel ──────────────────────────────────────────────────────────

  const handleDone = useCallback(() => {
    onSave(currentPhoto);
  }, [onSave, currentPhoto]);

  // ─── Crop Tool ──────────────────────────────────────────────────────────────

  if (activeTool === "crop") {
    return (
      <CropTool
        imageUrl={currentPhoto.url}
        imageWidth={currentPhoto.width ?? 1024}
        imageHeight={currentPhoto.height ?? 1024}
        onApply={handleCropApply}
        onCancel={handleCropCancel}
      />
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "#000" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-4 pb-3"
        style={{ paddingTop: "calc(1rem + var(--safe-area-top, 0px))" }}
      >
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="flex items-center gap-1.5 text-sm font-medium text-white/80 disabled:opacity-40 transition-opacity active:opacity-60"
        >
          <XIcon />
          <span>Cancel</span>
        </button>
        <button
          onClick={handleDone}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-40 transition-opacity active:opacity-80"
          style={{ background: "var(--flow-accent, #2D5A27)" }}
        >
          <CheckIcon />
          <span>Done</span>
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center px-4">
        {previewMode === "enhance" && enhanceResult ? (
          <div className="w-full max-w-md">
            <BeforeAfterSlider
              beforeUrl={currentPhoto.url}
              afterUrl={enhanceResult.image.url}
              alt="Enhanced preview"
            />
          </div>
        ) : previewMode === "bg" && bgResultUrl ? (
          <div className="w-full max-w-md">
            <BeforeAfterSlider
              beforeUrl={currentPhoto.url}
              afterUrl={bgResultUrl}
              alt="Background removed preview"
            />
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhoto.url}
              alt="Edit photo"
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <Spinner size={40} />
                <p className="text-white text-sm mt-3 font-medium">
                  {isRotating && "Rotating..."}
                  {isCropping && "Cropping..."}
                  {isEnhancing && "Enhancing..."}
                  {isRemovingBg && "Removing background..."}
                </p>
              </div>
            )}
          </>
        )}

        {/* Error toast */}
        {error && !isProcessing && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center">
            <div
              className="px-4 py-3 rounded-xl text-sm font-medium text-white text-center max-w-sm"
              style={{ background: "rgba(220, 38, 38, 0.9)", backdropFilter: "blur(8px)" }}
            >
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Preview accept/discard buttons */}
      {previewMode === "enhance" && enhanceResult ? (
        <div
          className="px-6 pt-4 pb-6 flex gap-3"
          style={{
            background: "rgba(0,0,0,0.85)",
            paddingBottom: "calc(1.5rem + var(--safe-area-bottom, 0px))",
          }}
        >
          <button
            onClick={handleDiscardEnhance}
            className="flex-1 py-3 rounded-xl border border-white/30 text-white text-sm font-medium"
          >
            Discard
          </button>
          <button
            onClick={handleAcceptEnhance}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ background: "var(--flow-accent, #2D5A27)" }}
          >
            Use this photo
          </button>
        </div>
      ) : previewMode === "bg" && bgResultUrl ? (
        <div
          className="px-6 pt-4 pb-6 flex gap-3"
          style={{
            background: "rgba(0,0,0,0.85)",
            paddingBottom: "calc(1.5rem + var(--safe-area-bottom, 0px))",
          }}
        >
          <button
            onClick={handleDiscardBg}
            className="flex-1 py-3 rounded-xl border border-white/30 text-white text-sm font-medium"
          >
            Discard
          </button>
          <button
            onClick={handleAcceptBg}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ background: "var(--flow-accent, #2D5A27)" }}
          >
            Use this photo
          </button>
        </div>
      ) : (
        /* Toolbar */
        <div
          className="px-4 pt-4 pb-6"
          style={{
            background: "rgba(0,0,0,0.85)",
            paddingBottom: "calc(1.5rem + var(--safe-area-bottom, 0px))",
          }}
        >
          <div className="flex items-center justify-around max-w-sm mx-auto">
            <ToolButton
              icon={<RotateIcon />}
              label="Rotate"
              onClick={handleRotate}
              disabled={isProcessing}
            />
            <ToolButton
              icon={<CropIcon />}
              label="Crop"
              onClick={handleOpenCrop}
              disabled={isProcessing}
            />
            <ToolButton
              icon={<EnhanceIcon />}
              label="Enhance"
              onClick={handleEnhance}
              disabled={isProcessing}
            />
            <ToolButton
              icon={<BgRemoveIcon />}
              label="BG Remove"
              onClick={handleBgRemove}
              disabled={isProcessing}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tool Button ──────────────────────────────────────────────────────────────

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}

function ToolButton({ icon, label, onClick, disabled }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-white disabled:opacity-40 transition-opacity active:opacity-60"
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
