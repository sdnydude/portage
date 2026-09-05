"use client";

import { useState, useCallback } from "react";

export function useBulkSelect<T extends { id: string }>() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelecting = useCallback(() => {
    setIsSelecting((prev) => {
      if (prev) {
        // Exiting bulk mode — clear selection
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  return {
    selectedIds,
    isSelecting,
    toggle,
    selectAll,
    clearSelection,
    toggleSelecting,
    selectedCount: selectedIds.size,
  };
}
