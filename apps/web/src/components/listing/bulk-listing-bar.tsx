"use client";

interface BulkListingBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onActivate: () => void;
  isLoading?: boolean;
}

export function BulkListingBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  onDelete,
  onArchive,
  onActivate,
  isLoading = false,
}: BulkListingBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-lg mx-auto rounded-2xl border border-border bg-surface/95 backdrop-blur-md shadow-lg overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm font-semibold text-text-primary">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onSelectAll}
              disabled={isLoading}
              className="text-xs font-medium text-forest-green disabled:opacity-50"
            >
              All ({totalCount})
            </button>
            <span className="text-border">|</span>
            <button
              onClick={onClear}
              disabled={isLoading}
              className="text-xs font-medium text-text-secondary disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={onDelete}
            disabled={isLoading}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 disabled:opacity-50 active:scale-95 transition-transform"
            aria-label={`Delete ${selectedCount} listing${selectedCount !== 1 ? "s" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            <span className="text-[10px] font-medium">Delete</span>
          </button>

          <button
            onClick={onArchive}
            disabled={isLoading}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 disabled:opacity-50 active:scale-95 transition-transform"
            aria-label={`Archive ${selectedCount} listing${selectedCount !== 1 ? "s" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <span className="text-[10px] font-medium">Archive</span>
          </button>

          <button
            onClick={onActivate}
            disabled={isLoading}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 disabled:opacity-50 active:scale-95 transition-transform"
            aria-label={`Activate ${selectedCount} listing${selectedCount !== 1 ? "s" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-[10px] font-medium">Activate</span>
          </button>
        </div>
      </div>
    </div>
  );
}
