"use client";

import { useCallback } from "react";

interface UseListNavOptions {
  ids: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Arrow-key selection over an ordered id list (R1 workbench list panes). */
export function useListNav({ ids, selectedId, onSelect }: UseListNavOptions) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (ids.length === 0) return;
      // Text-editing surfaces own their nav keys (Home/End/arrows move the caret).
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      )
        return;
      const idx = selectedId ? ids.indexOf(selectedId) : -1;
      let next: number;
      switch (e.key) {
        case "ArrowDown":
          next = Math.min(idx + 1, ids.length - 1);
          break;
        case "ArrowUp":
          next = idx <= 0 ? 0 : idx - 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = ids.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      if (ids[next] !== selectedId) onSelect(ids[next]);
    },
    [ids, selectedId, onSelect],
  );

  return { onKeyDown };
}
