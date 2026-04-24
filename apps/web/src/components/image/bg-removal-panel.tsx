"use client";

import { useBgRemoval } from "@/hooks/use-bg-removal";
import { BeforeAfterSlider } from "./before-after-slider";

interface BgRemovalPanelProps {
  imageUrl: string;
  alt: string;
  onSave?: (blob: Blob) => void;
  onClose: () => void;
}

export function BgRemovalPanel({ imageUrl, alt, onSave, onClose }: BgRemovalPanelProps) {
  const { isProcessing, progress, resultUrl, result, error, removeBackground, reset } = useBgRemoval();

  const handleStart = () => removeBackground(imageUrl);

  const handleSave = () => {
    if (result && onSave) {
      onSave(result);
    }
    onClose();
  };

  const handleDiscard = () => {
    reset();
    onClose();
  };

  if (error) {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
        <button
          onClick={handleDiscard}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
        >
          Close
        </button>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="space-y-3">
        <div className="aspect-square bg-muted rounded-xl flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-2 border-forest-green border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium text-text-primary">Removing background...</p>
          <p className="text-xs text-text-secondary mt-1">{progress}%</p>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-forest-green rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (resultUrl) {
    return (
      <div className="space-y-3">
        <BeforeAfterSlider beforeUrl={imageUrl} afterUrl={resultUrl} alt={alt} />
        <div className="flex gap-3">
          <button
            onClick={handleDiscard}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
          >
            Discard
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium"
            >
              Use this photo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleStart}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-forest-green-50 text-forest-green text-sm font-medium hover:bg-forest-green-100 transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3a6 6 0 016 6c0 7-3 9-6 9s-6-2-6-9a6 6 0 016-6z" />
        <path d="M6 21h12" />
      </svg>
      Remove Background
    </button>
  );
}
