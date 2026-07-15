"use client";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  onUpdateCategory: () => void;
  onExport: () => void;
  isLoading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  onDelete,
  onUpdateCategory,
  onExport,
  isLoading = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[55] px-4 pb-2"
      // Clear the full tab bar (top edge = 0.5rem lift + 4rem height + safe-area)
      // with an 8px gap; safe-area lives in `bottom` so the gap holds on notch devices.
      style={{ bottom: "calc(5rem + var(--safe-area-bottom))" }}
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
            aria-label={`Delete ${selectedCount} item${selectedCount !== 1 ? "s" : ""}`}
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
            onClick={onUpdateCategory}
            disabled={isLoading}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 disabled:opacity-50 active:scale-95 transition-transform"
            aria-label="Update category"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-[10px] font-medium">Category</span>
          </button>

          <button
            onClick={onExport}
            disabled={isLoading}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-forest-green-50 dark:bg-green-950/30 text-forest-green dark:text-green-400 disabled:opacity-50 active:scale-95 transition-transform"
            aria-label={`Export ${selectedCount} item${selectedCount !== 1 ? "s" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="text-[10px] font-medium">Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}
