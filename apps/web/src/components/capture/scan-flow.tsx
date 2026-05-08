"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api, API_BASE } from "@/lib/api";
import { CameraCapture } from "./camera-capture";
import { ImagePicker } from "./image-picker";

type ScanState = "capture" | "scanning" | "review" | "saving";

interface ScanResult {
  name: string;
  description: string;
  category: string;
  condition: "new" | "like_new" | "good" | "fair" | "poor";
  conditionNotes: string;
  estimatedValueLow: number;
  estimatedValueHigh: number;
  brand: string | null;
  model: string | null;
  suggestedTags: string[];
}

interface ScanResponse {
  identification: ScanResult;
  image: { key: string; url: string; width: number; height: number } | null;
  thumbnail: { key: string; url: string } | null;
}

interface ScanFlowProps {
  onClose: () => void;
}

const conditionOptions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
] as const;

export function ScanFlow({ onClose }: ScanFlowProps) {
  const { token } = useAuth();
  const [state, setState] = useState<ScanState>("capture");
  const [showCamera, setShowCamera] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields from AI result
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCondition, setEditCondition] = useState<string>("good");
  const [editConditionNotes, setEditConditionNotes] = useState("");
  const [editValueLow, setEditValueLow] = useState("");
  const [editValueHigh, setEditValueHigh] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");

  const fileRef = useRef<File | null>(null);

  const handleScan = useCallback(
    async (file: File) => {
      if (!token) return;

      fileRef.current = file;
      setPreviewUrl(URL.createObjectURL(file));
      setState("scanning");
      setError(null);

      try {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(
          `${API_BASE}/scan`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Scan failed" }));
          throw new Error(data.error ?? "Scan failed");
        }

        const data = (await response.json()) as ScanResponse;
        setScanResponse(data);

        // Populate editable fields
        setEditName(data.identification.name);
        setEditDescription(data.identification.description);
        setEditCategory(data.identification.category);
        setEditCondition(data.identification.condition);
        setEditConditionNotes(data.identification.conditionNotes);
        setEditValueLow(String(data.identification.estimatedValueLow));
        setEditValueHigh(String(data.identification.estimatedValueHigh));
        setEditBrand(data.identification.brand ?? "");
        setEditModel(data.identification.model ?? "");

        setState("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
        setState("capture");
      }
    },
    [token]
  );

  const handleCameraCapture = useCallback(
    (file: File) => {
      setShowCamera(false);
      handleScan(file);
    },
    [handleScan]
  );

  const handleGallerySelect = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        handleScan(files[0]);
      }
    },
    [handleScan]
  );

  const handleSave = useCallback(async () => {
    if (!token || !scanResponse) return;

    setIsSaving(true);
    setState("saving");

    try {
      const valueLow = parseFloat(editValueLow) || 0;
      const valueHigh = parseFloat(editValueHigh) || 0;
      const valueRecommended = Math.round((valueLow + valueHigh) / 2);

      const photos = scanResponse.image
        ? [
            {
              url: scanResponse.image.url,
              key: scanResponse.image.key,
              width: scanResponse.image.width,
              height: scanResponse.image.height,
              isPrimary: true,
            },
          ]
        : [];

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
          features: scanResponse.identification.suggestedTags,
          estimatedValueMin: valueLow,
          estimatedValueMax: valueHigh,
          estimatedValueRecommended: valueRecommended,
          aiConfidenceScore: 0.85,
          photos,
        },
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
      setState("review");
      setIsSaving(false);
    }
  }, [
    token,
    scanResponse,
    editName,
    editDescription,
    editCategory,
    editCondition,
    editConditionNotes,
    editValueLow,
    editValueHigh,
    editBrand,
    editModel,
    onClose,
  ]);

  const handleRetry = useCallback(() => {
    setPreviewUrl(null);
    setScanResponse(null);
    setError(null);
    setState("capture");
  }, []);

  // Camera view
  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-slide-up-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <h2
          className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary"
          style={{ fontSize: "var(--text-headline)" }}
        >
          {state === "capture" && "Scan Item"}
          {state === "scanning" && "Analyzing..."}
          {state === "review" && "Review"}
          {state === "saving" && "Saving..."}
        </h2>
        <div className="w-10" />
      </header>

      {/* Capture state */}
      {state === "capture" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          {error && (
            <div className="w-full max-w-sm mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300 text-center">
              {error}
            </div>
          )}

          <div className="w-24 h-24 rounded-3xl bg-forest-green-50 flex items-center justify-center mb-6">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--forest-green)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
          <p
            className="text-text-secondary text-center mb-8 max-w-xs"
            style={{ fontSize: "var(--text-body)" }}
          >
            Take a clear photo or choose one from your gallery. Porter will identify it automatically.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={() => setShowCamera(true)}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-forest-green text-white font-semibold text-sm"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take Photo
            </button>

            <ImagePicker onSelect={handleGallerySelect}>
              <div className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-muted text-text-primary font-semibold text-sm cursor-pointer hover:bg-forest-green-50 transition-colors">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                Choose from Gallery
              </div>
            </ImagePicker>
          </div>
        </div>
      )}

      {/* Scanning state */}
      {state === "scanning" && previewUrl && (
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 overflow-hidden">
            <img
              src={previewUrl}
              alt="Scanning"
              className="w-full h-full object-cover"
            />
            {/* Shimmer overlay */}
            <div className="absolute inset-0 animate-shimmer" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white font-semibold text-lg">Porter is analyzing...</p>
                <p className="text-white/70 text-sm mt-1">
                  Identifying item, estimating value
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review state */}
      {state === "review" && previewUrl && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Photo hero — top section */}
          <div className="relative h-56 flex-shrink-0 overflow-hidden bg-black">
            <img
              src={previewUrl}
              alt={editName}
              className="w-full h-full object-cover"
            />
            <button
              onClick={handleRetry}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium"
            >
              Retake
            </button>
          </div>

          {/* Bottom sheet with editable AI results */}
          <div className="flex-1 overflow-y-auto bg-background rounded-t-2xl -mt-4 relative z-10 pb-24">
            <div className="w-12 h-1 rounded-full bg-border mx-auto mt-3 mb-4" />
            <div className="px-4 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label
                  className="block text-text-secondary mb-1"
                  style={{ fontSize: "var(--text-caption)" }}
                >
                  Item Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* Value range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-text-secondary mb-1"
                    style={{ fontSize: "var(--text-caption)" }}
                  >
                    Value Low ($)
                  </label>
                  <input
                    type="number"
                    value={editValueLow}
                    onChange={(e) => setEditValueLow(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label
                    className="block text-text-secondary mb-1"
                    style={{ fontSize: "var(--text-caption)" }}
                  >
                    Value High ($)
                  </label>
                  <input
                    type="number"
                    value={editValueHigh}
                    onChange={(e) => setEditValueHigh(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Condition */}
              <div>
                <label
                  className="block text-text-secondary mb-1"
                  style={{ fontSize: "var(--text-caption)" }}
                >
                  Condition
                </label>
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
                <label
                  className="block text-text-secondary mb-1"
                  style={{ fontSize: "var(--text-caption)" }}
                >
                  Condition Notes
                </label>
                <input
                  type="text"
                  value={editConditionNotes}
                  onChange={(e) => setEditConditionNotes(e.target.value)}
                  placeholder="e.g. Minor scuff on left side"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm placeholder:text-text-placeholder focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  className="block text-text-secondary mb-1"
                  style={{ fontSize: "var(--text-caption)" }}
                >
                  Category
                </label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-text-secondary mb-1"
                    style={{ fontSize: "var(--text-caption)" }}
                  >
                    Brand
                  </label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label
                    className="block text-text-secondary mb-1"
                    style={{ fontSize: "var(--text-caption)" }}
                  >
                    Model
                  </label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  className="block text-text-secondary mb-1"
                  style={{ fontSize: "var(--text-caption)" }}
                >
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm resize-none focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Save button — fixed at bottom */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] px-4 py-4 glass-thick glass-fallback border-t border-border"
            style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom))" }}
          >
            <button
              onClick={handleSave}
              disabled={!editName.trim() || isSaving}
              className="w-full py-4 rounded-2xl bg-forest-green text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              {isSaving ? "Saving..." : "Save to Inventory"}
            </button>
          </div>
        </div>
      )}

      {/* Saving state */}
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
