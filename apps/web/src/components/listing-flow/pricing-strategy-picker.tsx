"use client";

import type { ComponentType, ReactNode } from "react";
import type { PricingStrategy } from "@portage/shared";

const strategyLabels: Record<PricingStrategy, string> = {
  fast: "Sell Fast",
  market: "Market",
  max: "Max",
  custom: "Custom",
};

const STRATEGIES = ["fast", "market", "max"] as const satisfies readonly PricingStrategy[];

interface PricingStrategyPickerProps {
  active: PricingStrategy | null;
  onSelect: (strategy: PricingStrategy) => void;
  Pill: ComponentType<{
    children: ReactNode;
    small?: boolean;
    active?: boolean;
    onClick?: () => void;
  }>;
  tokens: {
    secondary: string;
  };
  label?: string;
}

export function PricingStrategyPicker({
  active, onSelect, Pill, tokens, label = "Strategy",
}: PricingStrategyPickerProps) {
  return (
    <div>
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        color: tokens.secondary,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        {label}
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        {STRATEGIES.map((s) => (
          <Pill key={s} small active={active === s} onClick={() => onSelect(s)}>
            {strategyLabels[s]}
          </Pill>
        ))}
      </div>
    </div>
  );
}
