"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CaptureSheet } from "./capture-sheet";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";

type ScanStep = "capture" | "scanning" | "review" | "saving";

interface VisionResult {
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
  identification: VisionResult;
  image: { key: string; url: string; width: number; height: number } | null;
  thumbnail: { key: string; url: string } | null;
}

interface CreatedItem {
  id: string;
}

interface ScanFlowProps {
  onClose: () => void;
}

export function ScanFlow({ onClose }: ScanFlowProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState<ScanStep>("capture");
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0 || !token) return;
    const file = files[0];

    setPreviewUrl(URL.createObjectURL(file));
    setStep("scanning");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://10.0.0.251:8016"}/scan`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Scan failed" }));
        throw new Error(data.error || `Scan failed (${response.status})`);
      }

      const result: ScanResponse = await response.json();
      setScanResult(result);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setStep("capture");
    }
  }, [token]);

  const handleSave = useCallback(async () => {
    if (!scanResult || !token) return;
    setStep("saving");
    setError(null);

    const { identification, image } = scanResult;
    const photos = image ? [{ url: image.url, key: image.key, width: image.width, height: image.height, isPrimary: true }] : [];

    try {
      const item = await api<CreatedItem>("/items", {
        method: "POST",
        token,
        body: {
          title: identification.name,
          description: identification.description,
          category: identification.category,
          condition: identification.condition,
          conditionNotes: identification.conditionNotes,
          brand: identification.brand ?? undefined,
          model: identification.model ?? undefined,
          features: identification.suggestedTags,
          estimatedValueMin: identification.estimatedValueLow,
          estimatedValueMax: identification.estimatedValueHigh,
          estimatedValueRecommended: Math.round((identification.estimatedValueLow + identification.estimatedValueHigh) / 2),
          photos,
        },
      });

      onClose();
      router.push(`/inventory/${item.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save item");
      setStep("review");
    }
  }, [scanResult, token, onClose, router]);

  const handleRetry = useCallback(() => {
    setScanResult(null);
    setPreviewUrl(null);
    setError(null);
    setStep("capture");
  }, []);

  if (step === "capture") {
    return (
      <>
        <CaptureSheet onFiles={handleFiles} onClose={onClose} />
        {error && (
          <div className="fixed top-4 left-4 right-4 z-[60] bg-red-50 dark:bg-red-950/90 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 shadow-lg">
            {error}
          </div>
        )}
      </>
    );
  }

  if (step === "scanning") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        {previewUrl && (
          <div className="w-32 h-32 rounded-2xl overflow-hidden mb-6 shadow-lg">
            <img src={previewUrl} alt="Scanning" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="w-10 h-10 border-3 border-forest-green border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Identifying item...</p>
        <p className="text-sm text-text-secondary mt-1">Porter is analyzing your photo</p>
      </div>
    );
  }

  if ((step === "review" || step === "saving") && scanResult) {
    const { identification, image } = scanResult;
    const avgValue = Math.round((identification.estimatedValueLow + identification.estimatedValueHigh) / 2);

    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4 pb-32">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={handleRetry} className="text-sm text-forest-green font-medium">Retake</button>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Review</h2>
            <button onClick={onClose} className="text-sm text-text-secondary">Cancel</button>
          </div>

          {/* Photo */}
          {(image?.url || previewUrl) && (
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-muted mb-4">
              <img src={image?.url || previewUrl!} alt={identification.name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Identification */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold font-[family-name:var(--font-instrument)] text-text-primary">
              {identification.name}
            </h3>
            <p className="text-sm text-text-secondary">{identification.description}</p>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-forest-green-50 text-forest-green font-medium capitalize">{identification.category}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-text-secondary font-medium capitalize">{identification.condition.replace("_", " ")}</span>
              {identification.brand && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-text-secondary font-medium">{identification.brand}</span>
              )}
            </div>

            {/* Value */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Estimated Value</p>
              <p className="text-2xl font-bold font-[family-name:var(--font-instrument)] text-forest-green">
                ${avgValue.toLocaleString()}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Range: ${identification.estimatedValueLow.toLocaleString()} – ${identification.estimatedValueHigh.toLocaleString()}
              </p>
            </div>

            {identification.conditionNotes && (
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Condition Notes</p>
                <p className="text-sm text-text-primary">{identification.conditionNotes}</p>
              </div>
            )}

            {identification.suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {identification.suggestedTags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-text-secondary">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 mt-4">
              {error}
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border px-4 py-4"
          style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom))" }}
        >
          <button
            onClick={handleSave}
            disabled={step === "saving"}
            className="w-full max-w-lg mx-auto block py-3.5 rounded-xl bg-forest-green text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
          >
            {step === "saving" ? "Saving..." : "Add to Inventory"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
