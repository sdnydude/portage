"use client";

import { useState, useEffect } from "react";
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
  // Hold the raw text locally so intermediate edits (deleting the first digit,
  // a trailing ".") aren't clobbered by the normalized parsed number.
  const [text, setText] = useState(value != null ? String(value) : "");

  // Sync from the prop on external change (AI prefill, reset) without clobbering an
  // in-progress edit whose parsed value already equals the prop.
  useEffect(() => {
    if (parsePriceInput(text) !== value) {
      setText(value != null ? String(value) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">$</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Price (USD)"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parsePriceInput(e.target.value));
        }}
        placeholder="Set your sale price"
        className="w-full pl-7 pr-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
      />
    </div>
  );
}
