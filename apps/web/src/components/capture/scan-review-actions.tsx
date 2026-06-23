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
  /** Listing quantity as a raw string (coerced to a whole number >= 1 at save). */
  quantity: string;
  onQuantityChange: (value: string) => void;
  /** Why Save is disabled (required fields incomplete) — shown below the buttons. */
  saveDisabledReason?: string | null;
  /** Marks the Price label with a red asterisk when price is a missing required field. */
  priceRequired?: boolean;
  /** Gates only Save & List (eBay aspects). Default true. */
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
  price, onPriceChange, quantity, onQuantityChange, onRescan, onSave, onSaveAndList, isSaving, isListing, canSave,
  saveDisabledReason = null, priceRequired = false, canList = true, listDisabledReason = null,
}: ScanReviewActionsProps) {
  const busy = isSaving || isListing;
  // Save gate is the broader one (required fields) — surface it first; the List
  // gate (eBay specifics) only matters once Save is satisfiable.
  const showSaveReason = !canSave && !!saveDisabledReason;
  const showListReason = canSave && !canList && !!listDisabledReason;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[70] px-4 py-3 glass-thick glass-fallback border-t border-border"
      style={{ paddingBottom: "calc(0.75rem + var(--safe-area-bottom))" }}
    >
      <div className="mb-2 flex items-end gap-3">
        <div className="w-20 shrink-0">
          <label htmlFor="scan-quantity" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Qty</label>
          <input
            id="scan-quantity"
            aria-label="Quantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none transition-colors"
          />
        </div>
        <div className="flex-1">
          <span className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
            Price
            {priceRequired && <span className="text-[var(--accent-error)]"> *</span>}
          </span>
          <PriceField value={price} onChange={onPriceChange} />
        </div>
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
      {showSaveReason && (
        <p className="mt-2 text-xs text-[var(--accent-error)] text-center">
          {saveDisabledReason}
        </p>
      )}
      {showListReason && (
        <p id="scan-list-disabled-reason" className="mt-2 text-xs text-text-secondary text-center">
          {listDisabledReason}
        </p>
      )}
    </div>
  );
}
