"use client";

import { PhotoCaptureFlow } from "./photo-capture-flow";
import type { PhotoCaptureFlowProps } from "./photo-capture-flow";

interface PhotoCaptureOverlayProps {
  show: boolean;
  onPhotos: PhotoCaptureFlowProps["onComplete"];
  onCancel: () => void;
}

export function PhotoCaptureOverlay({ show, onPhotos, onCancel }: PhotoCaptureOverlayProps) {
  if (!show) return null;

  return (
    <PhotoCaptureFlow
      onComplete={(photos) => {
        onCancel();
        if (photos.length > 0) {
          onPhotos(photos);
        }
      }}
      onCancel={onCancel}
    />
  );
}
