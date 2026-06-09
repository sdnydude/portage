"use client";

import { PriceField } from "@/components/listing/price-field";

export interface ScanReviewActionsProps {
  price: number | null;
  onPriceChange: (price: number | null) => void;
  onRescan: () => void;
  onSave: () => void;
  onSaveAndList: () => void;
  isSaving: boolean;
  isListing: boolean;
  canSave: boolean;
}

/**
 * Fixed bottom action bar for the scan review step: an editable sale price plus
 * Rescan / Save / Save & List. Extracted from scan-flow so the price wiring is
 * unit-testable in isolation. "Save & List" carries the entered price upward.
 */
export function ScanReviewActions({
  price, onPriceChange, onRescan, onSave, onSaveAndList, isSaving, isListing, canSave,
}: ScanReviewActionsProps) {
  const busy = isSaving || isListing;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[70] px-4 py-3 glass-thick glass-fallback border-t border-border"
      style={{ paddingBottom: "calc(0.75rem + var(--safe-area-bottom))" }}
    >
      <div className="mb-2">
        <span className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Price</span>
        <PriceField value={price} onChange={onPriceChange} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRescan}
          disabled={busy}
          className="flex-shrink-0 px-3 py-3.5 rounded-2xl bg-muted text-text-primary font-semibold text-sm disabled:opacity-50 transition-opacity"
        >
          Rescan
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || busy}
          className="flex-1 py-3.5 rounded-2xl bg-forest-green text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onSaveAndList}
          disabled={!canSave || busy}
          className="flex-1 py-3.5 rounded-2xl border-2 border-forest-green text-forest-green font-semibold text-sm disabled:opacity-50 transition-opacity"
        >
          {isListing ? "Listing..." : "Save & List"}
        </button>
      </div>
    </div>
  );
}
