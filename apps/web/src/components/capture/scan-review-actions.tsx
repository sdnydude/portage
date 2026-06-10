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
  /** Gates only Save & List (eBay aspects); Save is never gated. Default true. */
  canList?: boolean;
  /** Shown below the buttons (inside the bar), linked via aria-describedby when canList is false. */
  listDisabledReason?: string | null;
}

/**
 * Fixed bottom action bar for the scan review step: an editable sale price plus
 * Rescan / Save / Save & List. Extracted from scan-flow so the price wiring is
 * unit-testable in isolation. "Save & List" carries the entered price upward.
 */
export function ScanReviewActions({
  price, onPriceChange, onRescan, onSave, onSaveAndList, isSaving, isListing, canSave,
  canList = true, listDisabledReason = null,
}: ScanReviewActionsProps) {
  const busy = isSaving || isListing;
  const showListReason = !canList && !!listDisabledReason;
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
          className="flex-1 py-3.5 rounded-2xl bg-[var(--orange)] text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onSaveAndList}
          disabled={!canSave || !canList || busy}
          aria-describedby={showListReason ? "scan-list-disabled-reason" : undefined}
          className="flex-1 py-3.5 rounded-2xl border-2 border-[var(--orange)] text-[var(--orange)] font-semibold text-sm disabled:opacity-50 transition-opacity"
        >
          {isListing ? "Listing..." : "Save & List"}
        </button>
      </div>
      {showListReason && (
        <p id="scan-list-disabled-reason" className="mt-2 text-xs text-text-secondary text-center">
          {listDisabledReason}
        </p>
      )}
    </div>
  );
}
