"use client";

import { PhotoEditPanel } from "./photo-edit-panel";
import { CropTool } from "../listing-flow/crop-tool";
import type { UsePhotoEditReturn } from "@/hooks/use-photo-edit";

export function PhotoEditOverlay({
  photoEdit,
  photoCount,
  alt,
  onClosed,
}: {
  photoEdit: UsePhotoEditReturn;
  photoCount: number;
  alt: string;
  /** Runs after the editor closes — for hosts with extra teardown. */
  onClosed?: () => void;
}) {
  if (photoEdit.editingIndex === null || !photoEdit.editingPhoto) return null;
  if (photoEdit.showCrop) {
    return (
      <CropTool
        imageUrl={photoEdit.editingPhoto.url}
        imageWidth={photoEdit.editingPhoto.width ?? 1024}
        imageHeight={photoEdit.editingPhoto.height ?? 1024}
        onApply={photoEdit.applyCrop}
        onCancel={photoEdit.cancelCrop}
      />
    );
  }
  return (
    <PhotoEditPanel
      photo={{ url: photoEdit.editingPhoto.url }}
      photoIndex={photoEdit.editingIndex}
      photoCount={photoCount}
      onClose={() => {
        photoEdit.closeEditor();
        onClosed?.();
      }}
      onRotate={photoEdit.rotate}
      onCrop={() => !photoEdit.isProcessing && photoEdit.openCrop()}
      onEnhance={photoEdit.enhanceCurrent}
      onBgRemove={photoEdit.bgRemoveCurrent}
      isProcessing={photoEdit.isProcessing}
      processingLabel={photoEdit.processingLabel}
      error={photoEdit.error}
      pendingPreview={photoEdit.pendingPreview ? { ...photoEdit.pendingPreview, alt } : null}
    />
  );
}
