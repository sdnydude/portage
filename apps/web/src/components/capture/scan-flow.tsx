"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api, API_BASE } from "@/lib/api";
import { CameraCapture } from "./camera-capture";
import { ImagePicker } from "./image-picker";
import { useEnhance } from "@/hooks/use-enhance";
import { useBgRemoval } from "@/hooks/use-bg-removal";
import { CropTool } from "@/components/listing-flow/crop-tool";
import type { RecognitionCandidate } from "@portage/shared";

// ─── Types ───────────────────────────────────────────────────────────────────

type ScanState = "capture" | "uploading" | "scanning" | "review" | "saving";

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
}

interface RefineResponse {
  identification: RecognitionCandidate;
  detailed: {
    candidates: RecognitionCandidate[];
    reasoning: string[];
  };
}

interface ScanFlowProps {
  onClose: () => void;
}

const MAX_PHOTOS = 12;

const conditionOptions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
] as const;

// ─── Icons ───────────────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────────

export function ScanFlow({ onClose }: ScanFlowProps) {
  const { token } = useAuth();
  const [state, setState] = useState<ScanState>("capture");
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // AI results
  const [candidates, setCandidates] = useState<RecognitionCandidate[]>([]);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [showReasoning, setShowReasoning] = useState(false);

  // Editable fields from selected candidate
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCondition, setEditCondition] = useState<string>("good");
  const [editConditionNotes, setEditConditionNotes] = useState("");
  const [editValueLow, setEditValueLow] = useState("");
  const [editValueHigh, setEditValueHigh] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");

  // Inline editing tools
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
  const [isRotating, setIsRotating] = useState(false);
  const [activeTool, setActiveTool] = useState<"none" | "crop">("none");
  const isToolProcessing = isRotating || isEnhancing || isRemovingBg;

  const stripRef = useRef<HTMLDivElement>(null);

  // Reset editing hooks when switching photos
  useEffect(() => {
    resetEnhance();
    resetBgRemoval();
  }, [selectedPhotoIndex, resetEnhance, resetBgRemoval]);

  // React to enhance result
  useEffect(() => {
    if (enhanceResult) {
      setPhotos((prev) =>
        prev.map((p, i) =>
          i === selectedPhotoIndex
            ? { ...p, url: enhanceResult.image.url, key: enhanceResult.image.key, width: enhanceResult.image.width, height: enhanceResult.image.height }
            : p,
        ),
      );
      resetEnhance();
    }
  }, [enhanceResult, selectedPhotoIndex, resetEnhance]);

  useEffect(() => {
    if (enhanceError) {
      setError(enhanceError);
      resetEnhance();
    }
  }, [enhanceError, resetEnhance]);

  // React to bg removal result
  useEffect(() => {
    if (bgResultUrl) {
      setPhotos((prev) =>
        prev.map((p, i) => (i === selectedPhotoIndex ? { ...p, url: bgResultUrl } : p)),
      );
      resetBgRemoval();
    }
  }, [bgResultUrl, selectedPhotoIndex, resetBgRemoval]);

  useEffect(() => {
    if (bgError) {
      setError(bgError);
      resetBgRemoval();
    }
  }, [bgError, resetBgRemoval]);

  // ─── Upload a file immediately to R2 ────────────────────────────────────────

  const uploadPhoto = useCallback(
    async (file: File): Promise<CapturedPhoto | null> => {
      if (!token) return null;
      try {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`${API_BASE}/images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(data.error ?? "Upload failed");
        }

        const data = await response.json();
        return {
          url: data.image.url,
          key: data.image.key,
          width: data.image.width,
          height: data.image.height,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        return null;
      }
    },
    [token],
  );

  // ─── Capture handlers ──────────────────────────────────────────────────────

  const handleCameraCapture = useCallback(
    async (file: File) => {
      setShowCamera(false);
      if (photos.length >= MAX_PHOTOS) return;

      setState("uploading");
      setError(null);
      const photo = await uploadPhoto(file);
      if (photo) {
        setPhotos((prev) => [...prev, photo]);
        setSelectedPhotoIndex(photos.length);
      }
      setState("capture");
    },
    [photos.length, uploadPhoto],
  );

  const handleGallerySelect = useCallback(
    async (files: File[]) => {
      const remaining = MAX_PHOTOS - photos.length;
      const toUpload = files.slice(0, remaining);
      if (toUpload.length === 0) return;

      setState("uploading");
      setError(null);

      for (const file of toUpload) {
        const photo = await uploadPhoto(file);
        if (photo) {
          setPhotos((prev) => [...prev, photo]);
        }
      }
      setSelectedPhotoIndex(photos.length + toUpload.length - 1);
      setState("capture");
    },
    [photos.length, uploadPhoto],
  );

  const handleRemovePhoto = useCallback(
    (index: number) => {
      setPhotos((prev) => prev.filter((_, i) => i !== index));
      setSelectedPhotoIndex((prev) => Math.min(prev, Math.max(0, photos.length - 2)));
    },
    [photos.length],
  );

  // ─── Scan (sends URLs to /scan/refine) ────────────────────────────────────

  const handleScan = useCallback(async () => {
    if (!token || photos.length === 0) return;

    setState("scanning");
    setError(null);

    try {
      const imageUrls = photos.slice(0, 3).map((p) => p.url);

      const data = await api<RefineResponse>("/scan/refine", {
        method: "POST",
        token,
        body: { imageUrls },
      });

      setCandidates(data.detailed.candidates);
      setReasoning(data.detailed.reasoning);
      setSelectedCandidateIndex(0);
      populateFields(data.detailed.candidates[0]);
      setState("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setState("capture");
    }
  }, [token, photos]);

  const populateFields = useCallback((candidate: RecognitionCandidate) => {
    setEditName(candidate.name);
    setEditDescription(candidate.description);
    setEditCategory(candidate.category);
    setEditCondition(candidate.condition);
    setEditConditionNotes(candidate.conditionNotes);
    setEditValueLow(String(candidate.estimatedValueLow));
    setEditValueHigh(String(candidate.estimatedValueHigh));
    setEditBrand(candidate.brand ?? "");
    setEditModel(candidate.model ?? "");
  }, []);

  const handleSelectCandidate = useCallback(
    (index: number) => {
      setSelectedCandidateIndex(index);
      populateFields(candidates[index]);
    },
    [candidates, populateFields],
  );

  // ─── Rescan ────────────────────────────────────────────────────────────────

  const handleRescan = useCallback(async () => {
    if (!token || photos.length === 0) return;
    setState("scanning");
    setError(null);

    try {
      const imageUrls = photos.slice(0, 3).map((p) => p.url);
      const data = await api<RefineResponse>("/scan/refine", {
        method: "POST",
        token,
        body: { imageUrls },
      });

      setCandidates(data.detailed.candidates);
      setReasoning(data.detailed.reasoning);
      setSelectedCandidateIndex(0);
      populateFields(data.detailed.candidates[0]);
      setState("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rescan failed");
      setState("review");
    }
  }, [token, photos, populateFields]);

  // ─── Photo editing tools ───────────────────────────────────────────────────

  const selectedPhoto = photos[selectedPhotoIndex];

  const handleRotate = useCallback(async () => {
    if (!token || isToolProcessing || !selectedPhoto) return;
    setIsRotating(true);
    setError(null);

    try {
      const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/rotate", {
        method: "POST",
        body: { imageUrl: selectedPhoto.url, degrees: 90 },
        token,
      });
      setPhotos((prev) =>
        prev.map((p, i) =>
          i === selectedPhotoIndex
            ? { ...p, url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height }
            : p,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setIsRotating(false);
    }
  }, [token, isToolProcessing, selectedPhoto, selectedPhotoIndex]);

  const handleEnhance = useCallback(() => {
    if (isToolProcessing || !selectedPhoto) return;
    setError(null);
    enhance(selectedPhoto.url);
  }, [isToolProcessing, enhance, selectedPhoto]);

  const handleBgRemove = useCallback(() => {
    if (isToolProcessing || !selectedPhoto) return;
    setError(null);
    removeBackground(selectedPhoto.url);
  }, [isToolProcessing, removeBackground, selectedPhoto]);

  const handleCropApply = useCallback(
    async (crop: { x: number; y: number; width: number; height: number }) => {
      if (!token || !selectedPhoto) return;
      setError(null);

      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/crop", {
          method: "POST",
          body: { imageUrl: selectedPhoto.url, crop },
          token,
        });
        setPhotos((prev) =>
          prev.map((p, i) =>
            i === selectedPhotoIndex
              ? { ...p, url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height }
              : p,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Crop failed");
      } finally {
        setActiveTool("none");
      }
    },
    [token, selectedPhoto, selectedPhotoIndex],
  );

  // ─── Save to inventory ────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!token || photos.length === 0) return;

    setIsSaving(true);
    setState("saving");

    try {
      const valueLow = parseFloat(editValueLow) || 0;
      const valueHigh = parseFloat(editValueHigh) || 0;
      const valueRecommended = Math.round((valueLow + valueHigh) / 2);

      const itemPhotos = photos.map((p, i) => ({
        url: p.url,
        key: p.key,
        width: p.width,
        height: p.height,
        isPrimary: i === 0,
      }));

      const selectedCandidate = candidates[selectedCandidateIndex];

      await api("/items", {
        method: "POST",
        token,
        body: {
          title: editName,
          description: editDescription,
          category: editCategory,
          condition: ["new", "like_new", "good", "fair", "poor"].includes(editCondition) ? editCondition : "good",
          conditionNotes: editConditionNotes,
          brand: editBrand || undefined,
          model: editModel || undefined,
          features: selectedCandidate?.features ?? [],
          estimatedValueMin: valueLow,
          estimatedValueMax: valueHigh,
          estimatedValueRecommended: valueRecommended,
          aiConfidenceScore: selectedCandidate?.confidence ?? 0.85,
          photos: itemPhotos,
        },
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
      setState("review");
      setIsSaving(false);
    }
  }, [
    token, photos, editName, editDescription, editCategory,
    editCondition, editConditionNotes, editValueLow, editValueHigh,
    editBrand, editModel, candidates, selectedCandidateIndex, onClose,
  ]);

  // ─── Back to capture from review ──────────────────────────────────────────

  const handleBackToCapture = useCallback(() => {
    setState("capture");
    setError(null);
  }, []);

  // ─── Crop tool overlay ────────────────────────────────────────────────────

  if (activeTool === "crop" && selectedPhoto) {
    return (
      <CropTool
        imageUrl={selectedPhoto.url}
        imageWidth={selectedPhoto.width ?? 1024}
        imageHeight={selectedPhoto.height ?? 1024}
        onApply={handleCropApply}
        onCancel={() => setActiveTool("none")}
      />
    );
  }

  // ─── Camera overlay ───────────────────────────────────────────────────────

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-slide-up-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          onClick={state === "review" ? handleBackToCapture : onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          aria-label={state === "review" ? "Back" : "Close"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {state === "review" ? (
              <path d="M19 12H5M12 19l-7-7 7-7" />
            ) : (
              <path d="M18 6L6 18M6 6l12 12" />
            )}
          </svg>
        </button>
        <h2
          className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary"
          style={{ fontSize: "var(--text-headline)" }}
        >
          {state === "capture" && "Scan Item"}
          {state === "uploading" && "Uploading..."}
          {state === "scanning" && "Analyzing..."}
          {state === "review" && "Review"}
          {state === "saving" && "Saving..."}
        </h2>
        <div className="w-10" />
      </header>

      {/* ─── CAPTURE STATE ─────────────────────────────────────────────── */}
      {(state === "capture" || state === "uploading") && (
        <div className="flex-1 flex flex-col">
          {error && (
            <div className="mx-4 mt-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 text-center">
              {error}
            </div>
          )}

          {photos.length === 0 ? (
            /* Empty state — first photo */
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
              <div className="w-24 h-24 rounded-3xl bg-forest-green-50 flex items-center justify-center mb-6">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>

              <h3
                className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-2"
                style={{ fontSize: "var(--text-title)" }}
              >
                Photograph your item
              </h3>
              <p className="text-text-secondary text-center mb-8 max-w-xs" style={{ fontSize: "var(--text-body)" }}>
                Take 2-3 clear photos from different angles. Porter will identify it using all images.
              </p>

              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={() => setShowCamera(true)}
                  disabled={state === "uploading"}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-forest-green text-white font-semibold disabled:opacity-50"
                  style={{ boxShadow: "var(--shadow-elevated)", fontSize: "var(--text-body)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Take Photo
                </button>

                <ImagePicker onSelect={handleGallerySelect} multiple>
                  <div className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-muted text-text-primary font-semibold cursor-pointer hover:bg-forest-green-50 transition-colors" style={{ fontSize: "var(--text-body)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    Choose from Gallery
                  </div>
                </ImagePicker>
              </div>
            </div>
          ) : (
            /* Has photos — show strip + add more + scan button */
            <div className="flex-1 flex flex-col">
              {/* Hero preview of selected photo */}
              <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[selectedPhotoIndex]?.url}
                  alt={`Photo ${selectedPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                {state === "uploading" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {/* Photo counter */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                  {photos.length}/{MAX_PHOTOS}
                </div>
              </div>

              {/* Horizontal photo strip */}
              <div className="bg-surface border-t border-border">
                <div ref={stripRef} className="flex gap-2 px-3 py-3 overflow-x-auto scrollbar-hide">
                  {photos.map((photo, i) => (
                    <button
                      key={photo.key}
                      onClick={() => setSelectedPhotoIndex(i)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                        i === selectedPhotoIndex ? "border-forest-green" : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePhoto(i); }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-error flex items-center justify-center"
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </button>
                  ))}

                  {/* Add photo button */}
                  {photos.length < MAX_PHOTOS && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setShowCamera(true)}
                        disabled={state === "uploading"}
                        className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-text-secondary hover:text-forest-green hover:border-forest-green transition-colors disabled:opacity-50"
                        aria-label="Take another photo"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Recommendation hint */}
                {photos.length === 1 && (
                  <p className="px-4 pb-2 text-text-secondary text-center" style={{ fontSize: "var(--text-caption)" }}>
                    Add 1-2 more angles for better identification
                  </p>
                )}
              </div>

              {/* Scan button */}
              <div
                className="px-4 py-4 bg-surface border-t border-border"
                style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom))" }}
              >
                <button
                  onClick={handleScan}
                  disabled={photos.length === 0 || state === "uploading"}
                  className="w-full py-4 rounded-2xl bg-forest-green text-white font-semibold disabled:opacity-50 transition-opacity"
                  style={{ boxShadow: "var(--shadow-elevated)", fontSize: "var(--text-body)" }}
                >
                  Scan {photos.length} Photo{photos.length !== 1 ? "s" : ""} with Porter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SCANNING STATE ────────────────────────────────────────────── */}
      {state === "scanning" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="relative mb-6">
            {/* Photo thumbnails in a cluster */}
            <div className="flex -space-x-4">
              {photos.slice(0, 3).map((photo, i) => (
                <div
                  key={photo.key}
                  className="w-20 h-20 rounded-xl overflow-hidden border-2 border-background"
                  style={{ transform: `rotate(${(i - 1) * 5}deg)` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-3 border-forest-green border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-text-primary font-semibold text-lg">Porter is analyzing...</p>
          <p className="text-text-secondary mt-1" style={{ fontSize: "var(--text-caption)" }}>
            {photos.length > 1
              ? `Cross-referencing ${Math.min(photos.length, 3)} photos`
              : "Identifying item and estimating value"}
          </p>
        </div>
      )}

      {/* ─── REVIEW STATE ──────────────────────────────────────────────── */}
      {state === "review" && photos.length > 0 && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Photo hero with editing toolbar */}
          <div className="relative bg-black flex-shrink-0">
            {/* Main photo */}
            <div className="h-56 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[selectedPhotoIndex]?.url}
                alt={editName}
                className="max-w-full max-h-full object-contain"
              />
              {isToolProcessing && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-white text-sm mt-3 font-medium">
                    {isRotating && "Rotating..."}
                    {isEnhancing && "Enhancing..."}
                    {isRemovingBg && "Removing background..."}
                  </p>
                </div>
              )}
            </div>

            {/* Inline editing toolbar */}
            <div className="flex items-center justify-around px-4 py-2 bg-black/80">
              <ToolButton icon={<RotateIcon />} label="Rotate" onClick={handleRotate} disabled={isToolProcessing} />
              <ToolButton icon={<CropIcon />} label="Crop" onClick={() => !isToolProcessing && setActiveTool("crop")} disabled={isToolProcessing} />
              <ToolButton icon={<EnhanceIcon />} label="Enhance" onClick={handleEnhance} disabled={isToolProcessing} />
              <ToolButton icon={<BgRemoveIcon />} label="BG Remove" onClick={handleBgRemove} disabled={isToolProcessing} />
            </div>

            {/* Horizontal photo strip */}
            <div className="flex gap-2 px-3 py-2 bg-black/60 overflow-x-auto scrollbar-hide">
              {photos.map((photo, i) => (
                <button
                  key={photo.key}
                  onClick={() => setSelectedPhotoIndex(i)}
                  className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === selectedPhotoIndex ? "border-forest-green" : "border-white/20"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}

              {/* Add more photos */}
              {photos.length < MAX_PHOTOS && (
                <ImagePicker onSelect={handleGallerySelect} multiple>
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 cursor-pointer hover:text-white/80 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                </ImagePicker>
              )}
            </div>
          </div>

          {/* Bottom sheet with editable AI results */}
          <div className="flex-1 overflow-y-auto bg-background rounded-t-2xl -mt-2 relative z-10 pb-28">
            <div className="w-12 h-1 rounded-full bg-border mx-auto mt-3 mb-4" />
            <div className="px-4 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Candidate selector */}
              {candidates.length > 1 && (
                <div>
                  <label className="block text-text-secondary mb-1.5" style={{ fontSize: "var(--text-caption)" }}>
                    AI Matches
                  </label>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {candidates.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectCandidate(i)}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl text-left transition-colors border ${
                          i === selectedCandidateIndex
                            ? "border-forest-green bg-forest-green-50"
                            : "border-border bg-surface hover:bg-muted"
                        }`}
                      >
                        <p className="text-sm font-medium text-text-primary truncate max-w-[200px]">{c.name}</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {Math.round(c.confidence * 100)}% match
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Reasoning collapsible */}
              {reasoning.length > 0 && (
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-forest-green-50 transition-colors"
                >
                  <span className="text-sm font-medium text-forest-green">Why this identification?</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round"
                    className={`transition-transform ${showReasoning ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
              {showReasoning && (
                <ul className="px-3 space-y-1.5">
                  {reasoning.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text-secondary">
                      <span className="text-forest-green mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Name */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Item Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* Value range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Value Low ($)</label>
                  <input
                    type="number"
                    value={editValueLow}
                    onChange={(e) => setEditValueLow(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Value High ($)</label>
                  <input
                    type="number"
                    value={editValueHigh}
                    onChange={(e) => setEditValueHigh(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Condition</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {conditionOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditCondition(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        editCondition === opt.value
                          ? "bg-forest-green text-white"
                          : "bg-muted text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition Notes */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Condition Notes</label>
                <input
                  type="text"
                  value={editConditionNotes}
                  onChange={(e) => setEditConditionNotes(e.target.value)}
                  placeholder="e.g. Minor scuff on left side"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary placeholder:text-text-placeholder focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Category</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Brand</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Model</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary resize-none focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Fixed bottom: Rescan + Save */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] px-4 py-3 glass-thick glass-fallback border-t border-border"
            style={{ paddingBottom: "calc(0.75rem + var(--safe-area-bottom))" }}
          >
            <div className="flex gap-3">
              <button
                onClick={handleRescan}
                disabled={isSaving}
                className="flex-shrink-0 px-4 py-3.5 rounded-2xl bg-muted text-text-primary font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                Rescan
              </button>
              <button
                onClick={handleSave}
                disabled={!editName.trim() || isSaving}
                className="flex-1 py-3.5 rounded-2xl bg-forest-green text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
                style={{ boxShadow: "var(--shadow-elevated)" }}
              >
                {isSaving ? "Saving..." : "Save to Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SAVING STATE ──────────────────────────────────────────────── */}
      {state === "saving" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-forest-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-text-primary font-semibold">Saving to inventory...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tool Button ─────────────────────────────────────────────────────────────

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
      className="flex flex-col items-center gap-1 px-3 py-1.5 text-white disabled:opacity-40 transition-opacity active:opacity-60"
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
