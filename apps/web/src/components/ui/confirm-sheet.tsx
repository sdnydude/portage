"use client";

interface ConfirmSheetProps {
  title: string;
  body: string;
  confirmLabel: string;
  /** Red confirm button (delete); amber otherwise (archive). */
  destructive?: boolean;
  /** Disables the confirm button and swaps in this label while busy. */
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Shared confirm bottom-sheet — extracted from the modal markup triplicated
 * across the listing/item detail pages (archive, delete, item-delete).
 */
export function ConfirmSheet({ title, body, confirmLabel, destructive = false, busyLabel, busy = false, onConfirm, onClose }: ConfirmSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
          {title}
        </h3>
        <p className="text-sm text-text-secondary">{body}</p>
        <div className="flex gap-3">
          <button
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
