"use client";

import type { PackageSize, ShippingMethod } from "@portage/shared";

interface ShippingConfigCardProps {
  packageSize: PackageSize | null;
  weight: number | null;
  shippingMethod: ShippingMethod | null;
  onPackageSizeChange: (size: PackageSize) => void;
  onWeightChange: (weight: number | null) => void;
  onShippingMethodChange: (method: ShippingMethod) => void;
  Pill: React.ComponentType<{
    children: React.ReactNode;
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
}

const PACKAGE_SIZES: PackageSize[] = ["small", "medium", "large"];
const SHIPPING_METHODS: ShippingMethod[] = ["calculated", "flat", "free"];

const methodLabels: Record<ShippingMethod, string> = {
  calculated: "Calculated",
  flat: "Flat rate",
  free: "Free",
};

export function ShippingConfigCard({
  packageSize, weight, shippingMethod,
  onPackageSizeChange, onWeightChange, onShippingMethodChange,
  Pill, tokens,
}: ShippingConfigCardProps) {
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: tokens.secondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 14,
    color: tokens.text,
    background: tokens.cardBg,
    border: `1px solid ${tokens.cardBorder}`,
    borderRadius: 8,
    padding: "8px 12px",
    outline: "none",
    boxSizing: "border-box",
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
      <div>
        <p style={labelStyle}>Weight (lbs)</p>
        <input
          type="number"
          min={0}
          step={0.1}
          value={weight ?? ""}
          onChange={(e) => onWeightChange(parseFloat(e.target.value) || null)}
          placeholder="0.0"
          style={inputStyle}
        />
      </div>
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
