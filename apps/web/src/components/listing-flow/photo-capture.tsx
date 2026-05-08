"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCamera } from "@/hooks/use-camera";
import { useAuth } from "@/hooks/use-auth";
import { API_BASE } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface PhotoCaptureProps {
  onPhotoCaptured: (photos: CapturedPhoto[]) => void;
  onCancel: () => void;
}

type Mode = "choose" | "camera" | "preview";

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

function LibraryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
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

function SwitchCameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M8 21H3v-5" />
      <path d="M21 3l-7 7M3 21l7-7" />
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

// ─── Choose Mode ──────────────────────────────────────────────────────────────

interface ChooseModeProps {
  onTakePhoto: () => void;
  onFileSelected: (file: File) => void;
  onCancel: () => void;
}

function ChooseMode({ onTakePhoto, onFileSelected, onCancel }: ChooseModeProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      // Reset input so the same file can be selected again
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
          Add Photo
        </h2>
        {/* Spacer to balance header */}
        <div className="w-10" />
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: "rgba(0,0,0,0.08)" }} />

      {/* Options */}
      <div className="flex-1 flex flex-col justify-center px-6 gap-4">
        {/* Take Photo */}
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
            <p
              className="text-base font-semibold"
              style={{ color: "var(--flow-text, #18191C)" }}
            >
              Take Photo
            </p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(24,25,28,0.5)" }}>
              Use your camera
            </p>
          </div>
          <svg className="ml-auto opacity-30" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>

        {/* Upload Photo */}
        <button
          onClick={() => uploadRef.current?.click()}
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
            <p
              className="text-base font-semibold"
              style={{ color: "var(--flow-text, #18191C)" }}
            >
              Upload Photo
            </p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(24,25,28,0.5)" }}>
              JPEG, PNG, WebP, HEIC
            </p>
          </div>
          <svg className="ml-auto opacity-30" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Choose from Library */}
        <button
          onClick={() => libraryRef.current?.click()}
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
            <LibraryIcon />
          </span>
          <div className="text-left">
            <p
              className="text-base font-semibold"
              style={{ color: "var(--flow-text, #18191C)" }}
            >
              Choose from Library
            </p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(24,25,28,0.5)" }}>
              Select an existing photo
            </p>
          </div>
          <svg className="ml-auto opacity-30" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <input
          ref={libraryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Bottom safe area */}
      <div style={{ height: "var(--safe-area-bottom, 0px)" }} />
    </div>
  );
}

// ─── Camera Mode ──────────────────────────────────────────────────────────────

interface CameraModeProps {
  onCaptured: (blob: Blob) => void;
  onBack: () => void;
}

function CameraMode({ onCaptured, onBack }: CameraModeProps) {
  const { videoRef, canvasRef, isReady, error, start, stop, capture, switchCamera } = useCamera();
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    start();
    return () => { stop(); };
  }, [start, stop]);

  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
    },
    [videoRef],
  );

  const handleCapture = useCallback(async () => {
    if (isCapturing || !isReady) return;
    setIsCapturing(true);
    const blob = await capture();
    if (blob) {
      stop();
      onCaptured(blob);
    }
    setIsCapturing(false);
  }, [capture, stop, onCaptured, isCapturing, isReady]);

  const handleBack = useCallback(() => {
    stop();
    onBack();
  }, [stop, onBack]);

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <div className="text-center">
              <p className="text-white text-lg mb-2">Camera unavailable</p>
              <p className="text-white/60 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ top: "calc(1rem + var(--safe-area-top, 0px))" }}
        >
          <ChevronLeftIcon />
        </button>

        {/* Switch camera */}
        <button
          onClick={switchCamera}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ top: "calc(1rem + var(--safe-area-top, 0px))" }}
        >
          <SwitchCameraIcon />
        </button>
      </div>

      {/* Capture controls */}
      <div
        className="bg-black px-6 py-8 flex items-center justify-center"
        style={{ paddingBottom: "calc(2rem + var(--safe-area-bottom, 0px))" }}
      >
        <button
          onClick={handleCapture}
          disabled={!isReady || isCapturing}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
        >
          <div
            className={`w-16 h-16 rounded-full transition-colors ${isCapturing ? "bg-red-500" : "bg-white"}`}
          />
        </button>
      </div>
    </div>
  );
}

// ─── Preview Mode ─────────────────────────────────────────────────────────────

interface PreviewModeProps {
  blob: Blob;
  previewUrl: string;
  onConfirm: () => void;
  onRetake: () => void;
  isUploading: boolean;
  uploadError: string | null;
  fromCamera: boolean;
}

function PreviewMode({
  previewUrl,
  onConfirm,
  onRetake,
  isUploading,
  uploadError,
  fromCamera,
}: PreviewModeProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "#000" }}
    >
      {/* Image */}
      <div className="flex-1 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Preview"
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <Spinner size={40} />
            <p className="text-white text-sm mt-3 font-medium">Uploading…</p>
          </div>
        )}

        {/* Error overlay */}
        {uploadError && !isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6">
            <p className="text-white text-base font-semibold text-center mb-1">Upload failed</p>
            <p className="text-white/70 text-sm text-center mb-6">{uploadError}</p>
            <button
              onClick={onConfirm}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--flow-accent, #2D5A27)" }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="px-6 pt-4 pb-6 flex gap-3"
        style={{
          background: "rgba(0,0,0,0.85)",
          paddingBottom: "calc(1.5rem + var(--safe-area-bottom, 0px))",
        }}
      >
        <button
          onClick={onRetake}
          disabled={isUploading}
          className="flex-1 py-4 rounded-xl text-sm font-semibold border border-white/30 text-white disabled:opacity-40 transition-opacity active:opacity-70"
        >
          {fromCamera ? "Retake" : "Choose Different"}
        </button>
        <button
          onClick={onConfirm}
          disabled={isUploading || !!uploadError}
          className="flex-1 py-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity active:opacity-70"
          style={{ background: "var(--flow-accent, #2D5A27)" }}
        >
          Use Photo
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PhotoCapture({ onPhotoCaptured, onCancel }: PhotoCaptureProps) {
  const { token } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fromCamera, setFromCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Clean up object URL on unmount or when it changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const goToPreview = useCallback((blob: Blob, wasCamera: boolean) => {
    const url = URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setPendingBlob(blob);
    setFromCamera(wasCamera);
    setUploadError(null);
    setMode("preview");
  }, []);

  const handleCameraCaptured = useCallback(
    (blob: Blob) => {
      goToPreview(blob, true);
    },
    [goToPreview],
  );

  const handleFileSelected = useCallback(
    (file: File) => {
      goToPreview(file, false);
    },
    [goToPreview],
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingBlob) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      const filename = `photo-${Date.now()}.jpg`;
      formData.append("image", pendingBlob, filename);

      const res = await fetch(`${API_BASE}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(errData.error ?? "Upload failed");
      }

      const data = await res.json() as {
        image: { key: string; url: string; width?: number; height?: number };
        thumbnail: { key: string; url: string };
      };

      onPhotoCaptured([
        {
          key: data.image.key,
          url: data.image.url,
          width: data.image.width,
          height: data.image.height,
          thumbnailUrl: data.thumbnail?.url,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }, [pendingBlob, token, onPhotoCaptured]);

  const handleRetake = useCallback(() => {
    setUploadError(null);
    if (fromCamera) {
      setMode("camera");
    } else {
      setMode("choose");
    }
  }, [fromCamera]);

  // Inject spinner keyframe once
  useEffect(() => {
    const id = "photo-capture-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  if (mode === "camera") {
    return (
      <CameraMode
        onCaptured={handleCameraCaptured}
        onBack={() => setMode("choose")}
      />
    );
  }

  if (mode === "preview" && pendingBlob && previewUrl) {
    return (
      <PreviewMode
        blob={pendingBlob}
        previewUrl={previewUrl}
        onConfirm={handleConfirm}
        onRetake={handleRetake}
        isUploading={isUploading}
        uploadError={uploadError}
        fromCamera={fromCamera}
      />
    );
  }

  return (
    <ChooseMode
      onTakePhoto={() => setMode("camera")}
      onFileSelected={handleFileSelected}
      onCancel={onCancel}
    />
  );
}
