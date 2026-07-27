"use client";

import { useState } from "react";

export interface AspectRequirement {
  name: string;
  /** eBay's allowed values for a constrained aspect, or null for free text. */
  values: string[] | null;
}

interface AspectFillSheetProps {
  /** The required item specifics eBay rejected the publish for. */
  missing: AspectRequirement[];
  /** Optional prefill (e.g. Brand/Model already known on the item). */
  initial?: Record<string, string[]>;
  marketplaceLabel?: string;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (aspects: Record<string, string[]>) => void;
}

/**
 * Bottom sheet that collects category-required eBay item specifics that a
 * listing is missing. Renders a value picker for constrained aspects (eBay
 * supplies the allowed values) and a free-text input otherwise. The saved
 * values are keyed by eBay's exact aspect name so they round-trip cleanly
 * back through the publish gate.
 */
export function AspectFillSheet({
  missing,
  initial,
  marketplaceLabel = "eBay",
  saving = false,
  error,
  onCancel,
  onSave,
}: AspectFillSheetProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const a of missing) {
      const pre = initial?.[a.name];
      if (pre && pre.length > 0) seed[a.name] = pre[0];
    }
    return seed;
  });

  const allFilled = missing.every((a) => (values[a.name] ?? "").trim().length > 0);

  const handleSave = () => {
    if (!allFilled || saving) return;
    const out: Record<string, string[]> = {};
    for (const a of missing) out[a.name] = [values[a.name].trim()];
    onSave(out);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={saving ? undefined : onCancel} />
      <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
        <div>
          <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            Complete {marketplaceLabel} details
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            {marketplaceLabel} requires these item specifics before this listing can go live.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-accent-error bg-red-50 dark:bg-red-950/30 p-3 text-sm text-accent-error">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {missing.map((a) => (
            <div key={a.name} className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">{a.name}</label>
              {a.values && a.values.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {a.values.map((v) => {
                    const selected = values[a.name] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setValues((p) => ({ ...p, [a.name]: v }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          selected
                            ? "bg-forest-green text-white border-forest-green"
                            : "border-border text-text-primary hover:bg-background"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={values[a.name] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [a.name]: e.target.value }))}
                  placeholder={`Enter ${a.name}`}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>

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
            disabled={!allFilled || saving}
            className="flex-1 py-2.5 px-4 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Publishing…" : "Save & publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
