"use client";

import { useEffect, useRef } from "react";

interface ConfirmSheetProps {
  title: string;
  body: string;
  confirmLabel: string;
  /** Red confirm button (delete); amber otherwise (archive). */
  destructive?: boolean;
  /** Disables the confirm button and swaps in this label while busy. */
  busyLabel?: string;
  busy?: boolean;
  /** Failure feedback rendered inside the sheet (keeps the modal open). */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Shared confirm bottom-sheet — extracted from the modal markup triplicated
 * across the listing/item detail pages (archive, delete, item-delete).
 */
export function ConfirmSheet({ title, body, confirmLabel, destructive = false, busyLabel, busy = false, error = null, onConfirm, onClose }: ConfirmSheetProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on the safe action when the modal opens, and returns to the
  // invoking element when the sheet unmounts.
  useEffect(() => {
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => invoker?.focus();
  }, []);

  // Manual focus trap (dependency-free): Tab cycles within the sheet.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [],
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
            return;
          }
          trapTab(e);
        }}
        className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
          {title}
        </h3>
        <p className="text-sm text-text-secondary">{body}</p>
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-medium text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-2.5 px-4 rounded-xl text-white text-sm font-medium disabled:opacity-50 ${
              destructive ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {busy ? busyLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
