"use client";

import { useState, useCallback, useRef } from "react";

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

interface PhotoGridProps {
  photos: CapturedPhoto[];
  minPhotos: number;
  maxPhotos: number;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const TIPS: Record<number, string> = {
  0: "Start with the front of the item — this becomes your hero photo",
  1: "Now capture the back",
  2: "Add side views and any labels or serial numbers",
  3: "One more needed! Show any flaws, scratches, or wear",
};

function getTip(count: number, max: number): string {
  if (count >= max) return "Maximum photos reached";
  if (TIPS[count]) return TIPS[count];
  if (count < 8) return "Looking good! More angles help buyers feel confident";
  return "Great coverage! Add detail shots of unique features";
}

export function PhotoGrid({ photos, minPhotos, maxPhotos, onAdd, onEdit, onDelete, onReorder }: PhotoGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? null);
  const canAdd = photos.length < maxPhotos;

  const handleLongPressStart = useCallback((index: number) => {
    if (!photos[index]) return;
    longPressTimer.current = setTimeout(() => {
      setDragIndex(index);
      setIsDragging(true);
    }, 500);
  }, [photos]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging && dragIndex !== null) {
      setIsDragging(false);
      setDragIndex(null);
    }
  }, [isDragging, dragIndex]);

  const handleDrop = useCallback((toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex && photos[toIndex] !== undefined) {
      onReorder(dragIndex, toIndex);
    }
    setDragIndex(null);
    setIsDragging(false);
  }, [dragIndex, onReorder, photos]);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-3 gap-2 p-4">
        {slots.map((photo, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl overflow-hidden transition-all"
            style={{
              background: photo ? undefined : "rgba(0,0,0,0.04)",
              border: photo ? "none" : "2px dashed rgba(0,0,0,0.15)",
              opacity: dragIndex === i ? 0.5 : 1,
              transform: dragIndex === i ? "scale(0.95)" : "scale(1)",
            }}
            onPointerDown={() => handleLongPressStart(i)}
            onPointerUp={() => {
              handleLongPressEnd();
              if (!isDragging && photo) onEdit(i);
            }}
            onPointerEnter={() => { if (isDragging) handleDrop(i); }}
          >
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                {i === 0 && (
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    HERO
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <span className="text-white text-xs">✕</span>
                </button>
              </>
            ) : (
              i === photos.length && canAdd ? (
                <button
                  onClick={onAdd}
                  className="w-full h-full flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-2xl" style={{ color: "var(--flow-accent, #2D5A27)" }}>+</span>
                  <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.4)" }}>Add</span>
                </button>
              ) : null
            )}
          </div>
        ))}
      </div>

      <div className="px-6 py-2">
        <p className="text-sm text-center" style={{ color: "rgba(0,0,0,0.45)" }}>
          {getTip(photos.length, maxPhotos)}
        </p>
      </div>
    </div>
  );
}
