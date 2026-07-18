"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseListNavOptions {
  ids: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Selecting remounts the detail pane (key={selectedId}) — ~2 fetches per
// commit — so a held arrow key must not commit every repeat.
const COMMIT_DEBOUNCE_MS = 150;

/** Arrow-key selection over an ordered id list (R1 workbench list panes). */
export function useListNav({ ids, selectedId, onSelect }: UseListNavOptions) {
  // Burst position between commits: key repeats outrun the selectedId
  // round-trip, so navigation advances from here, not the committed id.
  const pendingIdxRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

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
      const idx = pendingIdxRef.current ?? (selectedId ? ids.indexOf(selectedId) : -1);
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
      pendingIdxRef.current = next;
      if (timerRef.current === null) {
        // Leading edge: single presses commit instantly.
        if (ids[next] !== selectedId) onSelect(ids[next]);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          pendingIdxRef.current = null;
        }, COMMIT_DEBOUNCE_MS);
      } else {
        // Inside a burst: accumulate, commit once trailing.
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          const settled = pendingIdxRef.current;
          pendingIdxRef.current = null;
          if (settled !== null && ids[settled] !== selectedId) onSelect(ids[settled]);
        }, COMMIT_DEBOUNCE_MS);
      }
    },
    [ids, selectedId, onSelect],
  );

  return { onKeyDown };
}
