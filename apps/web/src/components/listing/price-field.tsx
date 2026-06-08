"use client";

import { parsePriceInput } from "@/lib/price";

export interface PriceFieldProps {
  value: number | null;
  onChange: (price: number | null) => void;
}

/**
 * Editable sale-price input ($ prefixed). Emits a parsed number, or null when
 * the field is empty/invalid/non-positive (the "unset" sentinel). Parsing lives
 * in the tested `parsePriceInput` helper; this component is presentation + wiring.
 */
export function PriceField({ value, onChange }: PriceFieldProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">$</span>
      <input
        type="number"
        min={0.01}
        step={0.01}
        inputMode="decimal"
        aria-label="Price (USD)"
        value={value ?? ""}
        onChange={(e) => onChange(parsePriceInput(e.target.value))}
        placeholder="Set your sale price"
        className="w-full pl-7 pr-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
      />
    </div>
  );
}
