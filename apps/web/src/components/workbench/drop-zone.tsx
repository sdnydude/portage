"use client";

import { useCallback, useState } from "react";
import { partitionDroppedFiles } from "@/lib/desktop-ingest";

interface DropZoneProps {
  /** Accepted image files from a drop (already partitioned). */
  onFiles: (files: File[]) => void;
  /** Non-image files that were rejected at the drop boundary. */
  onRejected?: (files: File[]) => void;
  children: React.ReactNode;
}

/**
 * Native HTML5 file-drop zone (Phase R2 — desktop ingest). Built on
 * DataTransfer, not usePhotoDrag (that's a pointer-based reorder for
 * already-uploaded photos, not OS file drops).
 */
export function DropZone({ onFiles, onRejected, children }: DropZoneProps) {
  const [isActive, setIsActive] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsActive(false);
      const { accepted, rejected } = partitionDroppedFiles(
        Array.from(e.dataTransfer.files),
      );
      if (rejected.length > 0) onRejected?.(rejected);
      onFiles(accepted);
    },
    [onFiles, onRejected],
  );

  return (
    <div
      data-testid="drop-zone"
      data-active={isActive || undefined}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsActive(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setIsActive(false)}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
