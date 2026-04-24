"use client";

import { useState, useCallback } from "react";
import { CameraCapture } from "./camera-capture";
import { ImagePicker } from "./image-picker";

interface CaptureSheetProps {
  onFiles: (files: File[]) => void;
  onClose: () => void;
}

export function CaptureSheet({ onFiles, onClose }: CaptureSheetProps) {
  const [showCamera, setShowCamera] = useState(false);

  const handleCameraCapture = useCallback(
    (file: File) => {
      onFiles([file]);
    },
    [onFiles],
  );

  const handleGallerySelect = useCallback(
    (files: File[]) => {
      onFiles(files);
      onClose();
    },
    [onFiles, onClose],
  );

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-surface rounded-t-2xl border-t border-border overflow-hidden animate-slide-up"
        style={{ paddingBottom: "var(--safe-area-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 rounded-full bg-border mx-auto mt-3 mb-2" />
        <div className="px-4 pb-4 space-y-2">
          <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary text-center mb-4">
            Add Photos
          </h3>

          <button
            onClick={() => setShowCamera(true)}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-forest-green-50 hover:bg-forest-green-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-forest-green flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-text-primary">Take Photo</div>
              <div className="text-xs text-text-secondary">Use your camera to capture an item</div>
            </div>
          </button>

          <ImagePicker onSelect={handleGallerySelect} multiple>
            <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted hover:bg-forest-green-50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-text-secondary flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-text-primary">Choose from Gallery</div>
                <div className="text-xs text-text-secondary">Select existing photos</div>
              </div>
            </div>
          </ImagePicker>

          <button
            onClick={onClose}
            className="w-full p-3 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
