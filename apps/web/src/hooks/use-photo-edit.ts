"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";
import { useEnhance } from "./use-enhance";
import { useBgRemoval } from "./use-bg-removal";

type PhotoLike = { url: string; key?: string; width?: number; height?: number };

/**
 * Shared plumbing for the PhotoGalleryStrip + PhotoEditPanel pattern (S2.5-7).
 * Owns which photo is being edited and the four tools; the host renders the
 * strip/panel and persists updates via onPhotoUpdated (listing-flow state,
 * item PATCH, …) — the hook never persists.
 */
export function usePhotoEdit(
  photos: PhotoLike[],
  onPhotoUpdated: (index: number, patch: PhotoLike) => void | Promise<void>,
) {
  const { token } = useAuth();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);
  const { result: enhanceResult, isProcessing: isEnhancing, error: enhanceError, enhance, reset: resetEnhance } = useEnhance();
  const { resultUrl: bgResultUrl, isProcessing: isRemovingBg, error: bgError, removeBackground, reset: resetBgRemoval } = useBgRemoval();

  const editingPhoto = editingIndex !== null ? photos[editingIndex] : undefined;

  // Unaccepted tool results surface as a before/after preview; accept persists
  // via onPhotoUpdated, discard just resets the tool.
  const pendingPreview =
    enhanceResult && editingIndex !== null && editingPhoto
      ? {
          beforeUrl: editingPhoto.url,
          afterUrl: enhanceResult.image.url,
          onAccept: async () => {
            await onPhotoUpdated(editingIndex, {
              url: enhanceResult.image.url,
              key: enhanceResult.image.key,
              width: enhanceResult.image.width,
              height: enhanceResult.image.height,
            });
            resetEnhance();
          },
          onDiscard: () => {
            resetEnhance();
          },
        }
      : bgResultUrl && editingIndex !== null && editingPhoto
        ? {
            beforeUrl: editingPhoto.url,
            afterUrl: bgResultUrl,
            onAccept: async () => {
              await onPhotoUpdated(editingIndex, { url: bgResultUrl });
              resetBgRemoval();
            },
            onDiscard: () => {
              resetBgRemoval();
            },
          }
        : null;

  const isProcessing = isRotating || isEnhancing || isRemovingBg;
  const processingLabel = isRotating
    ? "Rotating..."
    : isEnhancing
      ? "Enhancing..."
      : isRemovingBg
        ? "Removing background..."
        : null;

  return {
    editingIndex,
    editingPhoto,
    showCrop,
    pendingPreview,
    isProcessing,
    processingLabel,
    error: toolError ?? enhanceError ?? bgError ?? null,
    openEditor(index: number) {
      setEditingIndex(index);
    },
    closeEditor() {
      // Closing with an unaccepted result discards it — nothing pending may
      // silently apply.
      resetEnhance();
      resetBgRemoval();
      setEditingIndex(null);
    },
    openCrop() {
      setShowCrop(true);
    },
    cancelCrop() {
      setShowCrop(false);
    },
    async enhanceCurrent() {
      if (editingIndex === null || !photos[editingIndex]) return;
      await enhance(photos[editingIndex].url);
    },
    async bgRemoveCurrent() {
      if (editingIndex === null || !photos[editingIndex]) return;
      await removeBackground(photos[editingIndex].url);
    },
    async applyCrop(crop: { x: number; y: number; width: number; height: number }) {
      if (!token || editingIndex === null || !photos[editingIndex]) return;
      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/crop", {
          method: "POST",
          body: { imageUrl: photos[editingIndex].url, crop },
          token,
        });
        await onPhotoUpdated(editingIndex, {
          url: data.image.url,
          key: data.image.key,
          width: data.image.width,
          height: data.image.height,
        });
      } catch (err) {
        setToolError(err instanceof Error ? err.message : "Crop failed");
      } finally {
        setShowCrop(false);
      }
    },
    async rotate() {
      if (!token || isRotating || editingIndex === null || !photos[editingIndex]) return;
      setIsRotating(true);
      setToolError(null);
      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/rotate", {
          method: "POST",
          body: { imageUrl: photos[editingIndex].url, degrees: 90 },
          token,
        });
        await onPhotoUpdated(editingIndex, {
          url: data.image.url,
          key: data.image.key,
          width: data.image.width,
          height: data.image.height,
        });
      } catch (err) {
        setToolError(err instanceof Error ? err.message : "Rotation failed");
      } finally {
        setIsRotating(false);
      }
    },
  };
}
