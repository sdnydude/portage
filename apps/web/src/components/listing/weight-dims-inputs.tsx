"use client";

import type { CSSProperties } from "react";
import { poundsToLbOz, lbOzToPounds } from "@/lib/weight";

/**
 * Controlled weight + dimension fields shared across the listing flows, the item
 * edit page, and the publish-time weight fill sheet.
 *
 * `weight` is decimal POUNDS (matching ListingFlowState / item state); the UI
 * presents it as a lb + oz pair. Dimensions are inches. `ebayPackageType` is the
 * eBay PackageTypeEnum string — deliberately distinct from Portage's packageSize.
 *
 * Two presenters share one field-logic core:
 *  - <WeightDimsInputs>        Tailwind, for the edit page + fill sheet
 *  - <WeightDimsInputsInline>  inline styles + token colors, for the listing flows
 */

export interface WeightDimsValue {
  /** Decimal pounds. */
  weight: number | null;
  dimLength: number | null;
  dimWidth: number | null;
  dimHeight: number | null;
  ebayPackageType: string | null;
}

export type WeightDimsChange = (patch: Partial<WeightDimsValue>) => void;

/** eBay PackageTypeEnum subset relevant to small-parcel sellers. */
export const EBAY_PACKAGE_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "MAILING_BOX", label: "Box" },
  { value: "PACKAGE_THICK_ENVELOPE", label: "Padded envelope" },
  { value: "LARGE_ENVELOPE", label: "Large envelope" },
  { value: "LETTER", label: "Letter / mailer" },
  { value: "USPS_LARGE_PACKAGE", label: "Large package" },
];

const DIM_KEYS = ["dimLength", "dimWidth", "dimHeight"] as const;
const DIM_LABELS: Record<(typeof DIM_KEYS)[number], string> = {
  dimLength: "L",
  dimWidth: "W",
  dimHeight: "H",
};

/** Parse a numeric input value to a positive number, or null when empty/invalid. */
function parseDim(raw: string): number | null {
  const v = parseFloat(raw);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function parseIntField(raw: string): number {
  const v = parseInt(raw, 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Shared field-change wiring. Returns the derived lb/oz pair plus handlers that
 * map UI edits back onto the controlled WeightDimsValue. Manual edits are the
 * caller's signal to clear an AI-estimated flag (handled in the parent onChange).
 */
function weightDimsFields(value: WeightDimsValue, onChange: WeightDimsChange) {
  const { lb, oz } = poundsToLbOz(value.weight);

  return {
    lb,
    oz,
    setLb: (raw: string) => onChange({ weight: lbOzToPounds(parseIntField(raw), oz) }),
    setOz: (raw: string) => onChange({ weight: lbOzToPounds(lb, parseIntField(raw)) }),
    setDim: (key: (typeof DIM_KEYS)[number], raw: string) => onChange({ [key]: parseDim(raw) }),
    setPackageType: (raw: string) => onChange({ ebayPackageType: raw || null }),
  };
}

const ESTIMATE_HINT = "AI estimate · verify before publishing";

// ---------------------------------------------------------------------------
// Tailwind presenter — edit page + fill sheet
// ---------------------------------------------------------------------------

interface WeightDimsInputsProps {
  value: WeightDimsValue;
  onChange: WeightDimsChange;
  /** Show the "AI estimate · verify" hint above the fields. */
  estimated?: boolean;
}

export function WeightDimsInputs({ value, onChange, estimated }: WeightDimsInputsProps) {
  const f = weightDimsFields(value, onChange);
  const inputClass =
    "w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none";

  return (
    <div className="space-y-4">
      {estimated && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{ESTIMATE_HINT}</p>
      )}

      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
          Weight
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} inputMode="numeric"
              value={f.lb || ""} onChange={(e) => f.setLb(e.target.value)}
              placeholder="0" className={inputClass} aria-label="Pounds"
            />
            <span className="text-sm text-text-secondary">lb</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={15} inputMode="numeric"
              value={f.oz || ""} onChange={(e) => f.setOz(e.target.value)}
              placeholder="0" className={inputClass} aria-label="Ounces"
            />
            <span className="text-sm text-text-secondary">oz</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
          Dimensions (in)
        </label>
        <div className="grid grid-cols-3 gap-3">
          {DIM_KEYS.map((key) => (
            <input
              key={key}
              type="number" min={0} step={0.1} inputMode="decimal"
              value={value[key] ?? ""} onChange={(e) => f.setDim(key, e.target.value)}
              placeholder={DIM_LABELS[key]} className={inputClass}
              aria-label={`${DIM_LABELS[key]} inches`}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
          Package type
        </label>
        <select
          value={value.ebayPackageType ?? ""} onChange={(e) => f.setPackageType(e.target.value)}
          className={inputClass}
        >
          <option value="">Not specified</option>
          {EBAY_PACKAGE_TYPES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline presenter — listing flows (dark cards, token colors, no Tailwind)
// ---------------------------------------------------------------------------

interface WeightDimsInputsInlineProps {
  value: WeightDimsValue;
  onChange: WeightDimsChange;
  estimated?: boolean;
  tokens: { text: string; secondary: string; cardBg: string; cardBorder: string };
  labelStyleOverride?: CSSProperties;
}

export function WeightDimsInputsInline({
  value, onChange, estimated, tokens, labelStyleOverride,
}: WeightDimsInputsInlineProps) {
  const f = weightDimsFields(value, onChange);

  const labelStyle: CSSProperties = labelStyleOverride ?? {
    fontSize: 11, fontWeight: 600, color: tokens.secondary,
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const inputStyle: CSSProperties = {
    width: "100%", fontSize: 14, color: tokens.text, background: tokens.cardBg,
    border: `1px solid ${tokens.cardBorder}`, borderRadius: 8,
    padding: "8px 12px", outline: "none", boxSizing: "border-box",
  };
  const unit: CSSProperties = { fontSize: 13, color: tokens.secondary };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {estimated && (
        <p style={{ fontSize: 12, fontWeight: 600, color: "#d97706", margin: 0 }}>{ESTIMATE_HINT}</p>
      )}

      <div>
        <p style={labelStyle}>Weight</p>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <input
              type="number" min={0} inputMode="numeric" placeholder="0"
              value={f.lb || ""} onChange={(e) => f.setLb(e.target.value)}
              style={inputStyle} aria-label="Pounds"
            />
            <span style={unit}>lb</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <input
              type="number" min={0} max={15} inputMode="numeric" placeholder="0"
              value={f.oz || ""} onChange={(e) => f.setOz(e.target.value)}
              style={inputStyle} aria-label="Ounces"
            />
            <span style={unit}>oz</span>
          </div>
        </div>
      </div>

      <div>
        <p style={labelStyle}>Dimensions (in)</p>
        <div style={{ display: "flex", gap: 8 }}>
          {DIM_KEYS.map((key) => (
            <input
              key={key}
              type="number" min={0} step={0.1} inputMode="decimal"
              placeholder={DIM_LABELS[key]}
              value={value[key] ?? ""} onChange={(e) => f.setDim(key, e.target.value)}
              style={inputStyle} aria-label={`${DIM_LABELS[key]} inches`}
            />
          ))}
        </div>
      </div>

      <div>
        <p style={labelStyle}>Package type</p>
        <select
          value={value.ebayPackageType ?? ""} onChange={(e) => f.setPackageType(e.target.value)}
          style={inputStyle}
        >
          <option value="">Not specified</option>
          {EBAY_PACKAGE_TYPES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
