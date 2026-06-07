"use client";

import { useState } from "react";
import { WeightDimsInputs, type WeightDimsValue } from "./weight-dims-inputs";

interface WeightFillSheetProps {
  /** Prefill (e.g. an AI estimate already on the item). */
  initial?: Partial<WeightDimsValue>;
  marketplaceLabel?: string;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (value: WeightDimsValue) => void;
}

const EMPTY: WeightDimsValue = {
  weight: null, dimLength: null, dimWidth: null, dimHeight: null, ebayPackageType: null,
};

/**
 * Bottom sheet that collects the package weight + dimensions an eBay Calculated
 * shipping publish was rejected for (error 25020 → EBAY_WEIGHT_REQUIRED). Mirrors
 * AspectFillSheet: the saved values are persisted to the item and the publish is
 * retried. Weight and all three dimensions are required (eBay computes the rate
 * from them); package type stays optional.
 */
export function WeightFillSheet({
  initial,
  marketplaceLabel = "eBay",
  saving = false,
  error,
  onCancel,
  onSave,
}: WeightFillSheetProps) {
  const [value, setValue] = useState<WeightDimsValue>({ ...EMPTY, ...initial });

  const complete =
    (value.weight ?? 0) > 0 &&
    (value.dimLength ?? 0) > 0 &&
    (value.dimWidth ?? 0) > 0 &&
    (value.dimHeight ?? 0) > 0;

  const handleSave = () => {
    if (!complete || saving) return;
    onSave(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={saving ? undefined : onCancel} />
      <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
        <div>
          <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            Add package weight
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            {marketplaceLabel} calculated shipping needs the package weight and
            dimensions before this listing can go live.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-accent-error bg-red-50 dark:bg-red-950/30 p-3 text-sm text-accent-error">
            {error}
          </div>
        )}

        <WeightDimsInputs value={value} onChange={(patch) => setValue((p) => ({ ...p, ...patch }))} />

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-medium text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!complete || saving}
            className="flex-1 py-2.5 px-4 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Publishing…" : "Save & publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
