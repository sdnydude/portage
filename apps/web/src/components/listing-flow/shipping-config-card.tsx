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
    </div>
  );
}
