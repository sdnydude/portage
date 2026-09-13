"use client";

import { useEffect, useRef, useState } from "react";
import type { RescanRow } from "@/lib/rescan-diff";

interface RescanDiffSheetProps {
  rows: RescanRow[];
  /** The item PATCH edit-syncs an active listing — say so before Apply. */
  hasLiveListing?: boolean;
  /** PATCH in flight — Apply disabled, label swapped. */
  busy?: boolean;
  /** Failure feedback rendered inside the sheet (keeps it open). */
  error?: string | null;
  /** Called with the checked row keys. */
  onApply: (keys: string[]) => void;
  onClose: () => void;
}

/**
 * Rescan result as a per-field diff: current value vs what the new scan saw.
 * The seller picks which fields to apply; nothing is written until they do.
 */
export function RescanDiffSheet({ rows, hasLiveListing = false, busy = false, error = null, onApply, onClose }: RescanDiffSheetProps) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.selected).map((r) => r.key)),
  );
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on the safe action when the sheet opens, and returns to the
  // invoking element when it unmounts (same contract as ConfirmSheet).
  useEffect(() => {
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => invoker?.focus();
  }, []);

  // Manual focus trap (dependency-free, same as ConfirmSheet, plus the
  // checkboxes this sheet has): Tab cycles within the panel.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? [],
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  };

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const count = checked.size;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Closing mid-Apply would not cancel the PATCH and would unmount the only
          surface that shows its error — so close is ignored while busy. */}
      <div className="fixed inset-0 bg-black/50" onClick={() => { if (!busy) onClose(); }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rescan-sheet-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            if (!busy) onClose();
            return;
          }
          trapTab(e);
        }}
        className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[85vh] flex flex-col"
      >
        <h3 id="rescan-sheet-title" className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
          Rescan results
        </h3>
        {rows.length === 0 && (
          <p className="text-sm text-text-secondary">The scan agrees with your current details.</p>
        )}
        {rows.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={count === rows.length}
              onChange={() =>
                setChecked(count === rows.length ? new Set() : new Set(rows.map((r) => r.key)))
              }
              className="h-4 w-4 accent-forest-green"
            />
            Select all
          </label>
        )}
        <ul className="space-y-3 overflow-y-auto flex-1 min-h-0">
          {rows.map((row) => {
            const id = `rescan-${row.key}`;
            return (
              <li key={row.key} className="flex items-start gap-3">
                <input
                  id={id}
                  type="checkbox"
                  aria-label={row.label}
                  checked={checked.has(row.key)}
                  onChange={() => toggle(row.key)}
                  className="mt-1 h-4 w-4 accent-forest-green"
                />
                <label htmlFor={id} className="flex-1 min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">{row.label}</span>
                  {row.current !== "" && (
                    <span className="block text-sm text-text-secondary line-through break-words">{row.current}</span>
                  )}
                  <span className="block text-sm text-text-primary break-words">{row.next}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {hasLiveListing && rows.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">Applying also updates your live listing.</p>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-medium text-text-primary disabled:opacity-50"
          >
            {rows.length === 0 ? "Close" : "Cancel"}
          </button>
          {rows.length > 0 && (
            <button
              onClick={() => onApply(Array.from(checked))}
              disabled={count === 0 || busy}
              className="flex-1 py-2.5 px-4 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Applying…" : `Apply ${count} ${count === 1 ? "change" : "changes"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
