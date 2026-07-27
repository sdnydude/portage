"use client";

import { MAX_PHOTOS_PER_ITEM } from "@portage/shared";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiUpload } from "@/lib/api";
import { PhotoGrid } from "./photo-grid";
import { CameraCapture } from "../capture/camera-capture";
import { PhotoEditOverlay } from "../capture/photo-edit-overlay";
import { usePhotoEdit } from "@/hooks/use-photo-edit";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface PhotoCaptureFlowProps {
  onComplete: (photos: CapturedPhoto[]) => void;
  onCancel: () => void;
  initialPhotos?: CapturedPhoto[];
  minPhotos?: number;
  maxPhotos?: number;
}

type Mode = "grid" | "choose" | "camera";

// ─── Icons ────────────────────────────────────────────────────────────────────

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function XIcon({ color = "white" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function Spinner({ size = 24, color = "white" }: { size?: number; color?: string }) {
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

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ─── Choose Mode ──────────────────────────────────────────────────────────────

interface ChooseModeProps {
  onTakePhoto: () => void;
  onFileSelected: (file: File) => void;
  onBack: () => void;
}

function ChooseMode({ onTakePhoto, onFileSelected, onBack }: ChooseModeProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      e.target.value = "";
    },
    [onFileSelected],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "var(--flow-bg, #F5F3EF)" }}
    >
      {/* Header */}
      <div
        className="flex items-center px-4 pt-4 pb-3"
        style={{ paddingTop: "calc(1rem + var(--safe-area-top, 0px))" }}
      >
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
          style={{ background: "rgba(0,0,0,0.06)" }}
        >
          <ChevronLeftIcon />
        </button>
        <h2
          className="flex-1 text-center text-lg font-semibold"
          style={{ color: "var(--flow-text, #18191C)", fontFamily: "var(--font-instrument-sans, sans-serif)" }}
        >
          Add Photo
        </h2>
        <div className="w-10" />
      </div>

      <div className="h-px" style={{ background: "rgba(0,0,0,0.08)" }} />

      {/* Options */}
      <div className="flex-1 flex flex-col justify-center px-6 gap-4">
        <button
          onClick={onTakePhoto}
          className="flex items-center gap-4 rounded-xl px-5 py-5 transition-all active:scale-[0.98]"
          style={{
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          <span
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--flow-accent, #2D5A27)", color: "white" }}
          >
            <CameraIcon />
          </span>
          <div className="text-left">
            <p className="text-base font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>
              Take Photo
            </p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(24,25,28,0.5)" }}>
              Use your camera
            </p>
          </div>
          <svg className="ml-auto opacity-30" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-4 rounded-xl px-5 py-5 transition-all active:scale-[0.98]"
          style={{
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          <span
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--flow-accent, #2D5A27)", color: "white" }}
          >
            <UploadIcon />
          </span>
          <div className="text-left">
            <p className="text-base font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>
              Upload / Choose
            </p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(24,25,28,0.5)" }}>
              JPEG, PNG, WebP, HEIC
            </p>
          </div>
          <svg className="ml-auto opacity-30" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div style={{ height: "var(--safe-area-bottom, 0px)" }} />
    </div>
  );
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export function PhotoCaptureFlow({
  onComplete,
  onCancel,
  initialPhotos = [],
  minPhotos = 4,
  maxPhotos = MAX_PHOTOS_PER_ITEM,
}: PhotoCaptureFlowProps) {
  const { token } = useAuth();
  const [photos, setPhotos] = useState<CapturedPhoto[]>(initialPhotos);
  const [mode, setMode] = useState<Mode>("grid");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasEnough = photos.length >= minPhotos;
  const remaining = minPhotos - photos.length;

  // Inject spinner keyframe once
  useEffect(() => {
    const id = "photo-capture-flow-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  // ─── Upload helper ──────────────────────────────────────────────────────────

  const uploadBlob = useCallback(
    async (blob: Blob): Promise<CapturedPhoto | null> => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        const filename = `photo-${Date.now()}.jpg`;
        formData.append("image", blob, filename);

        const data = await apiUpload<{
          image: { key: string; url: string; width?: number; height?: number };
          thumbnail: { key: string; url: string };
        }>("/images", formData, { token: token ?? undefined });

        return {
          key: data.image.key,
          url: data.image.url,
          width: data.image.width,
          height: data.image.height,
          thumbnailUrl: data.thumbnail?.url,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploadError(message);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [token],
  );

  // ─── Grid handlers ─────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    if (photos.length >= maxPhotos) return;
    setUploadError(null);
    setMode("choose");
  }, [photos.length, maxPhotos]);

  // Edits persist into the local capture list; the shared overlay hosts the
  // tools. The pre-edit thumbnail is dropped so the grid falls back to the
  // edited full image instead of a stale thumb.
  const photoEdit = usePhotoEdit(photos, (index, patch) => {
    setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch, thumbnailUrl: undefined } : p)));
  });

  const handleEdit = useCallback((index: number) => {
    photoEdit.openEditor(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoEdit.openEditor]);

  const handleDelete = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleDone = useCallback(() => {
    if (hasEnough) {
      onComplete(photos);
    }
  }, [hasEnough, photos, onComplete]);

  // ─── Choose handlers ───────────────────────────────────────────────────────

  const handleTakePhoto = useCallback(() => {
    setMode("camera");
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      const photo = await uploadBlob(file);
      if (photo) {
        setPhotos((prev) => [...prev, photo]);
        setMode("grid");
      }
    },
    [uploadBlob],
  );

  // ─── Camera handler ────────────────────────────────────────────────────────

  // Multi-shot: the shared CameraCapture keeps ONE stream for the whole
  // session (per-shot teardown made iOS/macOS Safari re-prompt for camera
  // permission on every added photo). Shots upload behind the viewfinder;
  // Done/✕ closes the camera once and returns to the grid.
  const handleCameraCaptured = useCallback(
    async (file: File) => {
      if (photos.length >= maxPhotos) return;
      const photo = await uploadBlob(file);
      if (photo) {
        setPhotos((prev) => [...prev, photo]);
      }
    },
    [uploadBlob, photos.length, maxPhotos],
  );

  // ─── Render: Camera ────────────────────────────────────────────────────────

  if (mode === "camera") {
    return (
      <CameraCapture
        onCapture={handleCameraCaptured}
        onClose={() => setMode("grid")}
      />
    );
  }

  // ─── Render: Choose ────────────────────────────────────────────────────────

  if (mode === "choose") {
    return (
      <ChooseMode
        onTakePhoto={handleTakePhoto}
        onFileSelected={handleFileSelected}
        onBack={() => setMode("grid")}
      />
    );
  }

  // ─── Render: Grid (default) — the editor overlay mounts above it ──────────

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "var(--flow-bg, #F5F3EF)" }}
    >
      <PhotoEditOverlay
        photoEdit={photoEdit}
        photoCount={photos.length}
        alt={photoEdit.editingIndex !== null ? `Photo ${photoEdit.editingIndex + 1}` : "Photo"}
      />

      {/* Header */}
      <div
        className="flex items-center px-4 pt-4 pb-3"
        style={{ paddingTop: "calc(1rem + var(--safe-area-top, 0px))" }}
      >
        <button
          onClick={onCancel}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
          style={{ background: "rgba(0,0,0,0.06)" }}
        >
          <XIcon color="var(--flow-text, #18191C)" />
        </button>
        <h2
          className="flex-1 text-center text-lg font-semibold"
          style={{ color: "var(--flow-text, #18191C)", fontFamily: "var(--font-instrument-sans, sans-serif)" }}
        >
          Photos
        </h2>
        <div className="w-10" />
      </div>

      <div className="h-px" style={{ background: "rgba(0,0,0,0.08)" }} />

      {/* Photo grid */}
      <div className="flex-1 overflow-y-auto">
        <PhotoGrid
          photos={photos}
          minPhotos={minPhotos}
          maxPhotos={maxPhotos}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      </div>

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/40">
          <div
            className="px-6 py-4 rounded-2xl flex items-center gap-3"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
          >
            <Spinner size={24} />
            <span className="text-white text-sm font-medium">Uploading...</span>
          </div>
        </div>
      )}

      {/* Upload error toast */}
      {uploadError && !isUploading && (
        <div className="absolute bottom-24 left-4 right-4 z-[55] flex justify-center">
          <div
            className="px-4 py-3 rounded-xl text-sm font-medium text-white text-center max-w-sm"
            style={{ background: "rgba(220, 38, 38, 0.9)", backdropFilter: "blur(8px)" }}
          >
            {uploadError}
          </div>
        </div>
      )}

      {/* Done button */}
      <div
        className="px-6 pt-4 pb-6"
        style={{ paddingBottom: "calc(1.5rem + var(--safe-area-bottom, 0px))" }}
      >
        <button
          onClick={handleDone}
          disabled={!hasEnough}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ background: "var(--flow-accent, #2D5A27)" }}
        >
          {hasEnough ? (
            <>
              <ScanIcon />
              <span>Done — scan with AI</span>
            </>
          ) : (
            <span>Need {remaining} more photo{remaining !== 1 ? "s" : ""}</span>
          )}
        </button>
      </div>
    </div>
  );
}
