"use client";

/**
 * BO-5: an AI-prepared Best Offer auto-accept floor must be SEEN before it
 * publishes — never invisible config riding the POST. Rendered by all three
 * listing-flow modes next to their publish action; "Remove" strips the floor
 * from what publishes (seller intent wins).
 */
export function BestOfferFloorNote({ floor, onClear }: { floor: number; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-secondary">
      <span>
        Offers auto-accept at <span className="font-semibold text-text-primary">${floor}</span> (from your seller profile)
      </span>
      <button
        type="button"
        aria-label="Remove auto-accept floor"
        onClick={onClear}
        className="shrink-0 underline underline-offset-2"
      >
        Remove
      </button>
    </div>
  );
}
