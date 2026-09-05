"use client";

import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { PackageSize, ShippingMethod } from "@portage/shared";
import {
  WeightDimsInputsInline,
  type WeightDimsValue,
  type WeightDimsChange,
} from "../listing/weight-dims-inputs";

interface ShippingConfigCardProps {
  packageSize: PackageSize | null;
  shippingMethod: ShippingMethod | null;
  weightDims: WeightDimsValue;
  weightEstimated?: boolean;
  /** Flat-rate buyer cost (beta 17be7322); input shown only for method='flat'. */
  shippingCost?: number | null;
  onShippingCostChange?: (cost: number | null) => void;
  onPackageSizeChange: (size: PackageSize) => void;
  onWeightDimsChange: WeightDimsChange;
  onShippingMethodChange: (method: ShippingMethod) => void;
  Pill: ComponentType<{
    children: ReactNode;
    small?: boolean;
    active?: boolean;
    onClick?: () => void;
  }>;
  tokens: {
    text: string;
    secondary: string;
    cardBg: string;
    cardBorder: string;
  };
  labelStyleOverride?: CSSProperties;
}

const PACKAGE_SIZES = ["small", "medium", "large"] as const satisfies readonly PackageSize[];
const SHIPPING_METHODS: ShippingMethod[] = ["calculated", "flat", "free"];

const methodLabels: Record<ShippingMethod, string> = {
  calculated: "Calculated",
  flat: "Flat rate",
  free: "Free",
};

export function ShippingConfigCard({
  packageSize, shippingMethod, weightDims, weightEstimated,
  shippingCost, onShippingCostChange,
  onPackageSizeChange, onWeightDimsChange, onShippingMethodChange,
  Pill, tokens, labelStyleOverride,
}: ShippingConfigCardProps) {
  const labelStyle: CSSProperties = labelStyleOverride ?? {
    fontSize: 11,
    fontWeight: 600,
    color: tokens.secondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <p style={labelStyle}>Package size</p>
        <div style={{ display: "flex", gap: 6 }}>
          {PACKAGE_SIZES.map((s) => (
            <Pill key={s} small active={packageSize === s} onClick={() => onPackageSizeChange(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Pill>
          ))}
        </div>
      </div>
      <WeightDimsInputsInline
        value={weightDims}
        onChange={onWeightDimsChange}
        estimated={weightEstimated}
        tokens={tokens}
        labelStyleOverride={labelStyleOverride}
      />
      <div>
        <p style={labelStyle}>Method</p>
        <div style={{ display: "flex", gap: 6 }}>
          {SHIPPING_METHODS.map((m) => (
            <Pill key={m} small active={shippingMethod === m} onClick={() => onShippingMethodChange(m)}>
              {methodLabels[m]}
            </Pill>
          ))}
        </div>
      </div>
      {shippingMethod === "flat" && onShippingCostChange && (
        <div>
          <label htmlFor="flat-shipping-cost" style={{ ...labelStyle, display: "block" }}>
            Buyer pays ($)
          </label>
          <input
            id="flat-shipping-cost"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={shippingCost ?? ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onShippingCostChange(Number.isFinite(v) ? v : null);
            }}
            placeholder="e.g. 5.00"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${tokens.cardBorder}`,
              background: tokens.cardBg,
              color: tokens.text,
              fontSize: 14,
            }}
          />
        </div>
      )}
    </div>
  );
}
