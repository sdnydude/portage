"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PricingData, CompResult, ReverbCompResult } from "@portage/shared";
import { demandLabel } from "@/lib/demand";

interface CompsPricingWidgetProps {
  pricing: PricingData;
  comps: { ebay: CompResult | null; reverb: ReverbCompResult | null };
  currentPrice: number;
  onPriceChange: (price: number) => void;
}

export function CompsPricingWidget({ pricing, comps, currentPrice, onPriceChange }: CompsPricingWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(currentPrice));
  const [activeTab, setActiveTab] = useState<"ebay" | "reverb">("ebay");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handlePriceSubmit = useCallback(() => {
    const num = parseFloat(editValue);
    if (!isNaN(num) && num > 0) {
      onPriceChange(Math.round(num * 100) / 100);
    }
    setIsEditing(false);
  }, [editValue, onPriceChange]);

  const confidenceLabel = pricing.conditionMatch === "exact"
    ? "exact match"
    : pricing.conditionMatch === "nearby"
    ? "similar condition"
    : "all conditions";

  // Explicit color/background pairs: the high branch uses teal CSS vars
  // (redesign direction), which can't be alpha-suffixed like a hex literal.
  const confidenceStyle = pricing.confidence === "high"
    ? { color: "var(--teal, #1A7A6D)", background: "var(--teal-soft, rgba(26,122,109,0.1))" }
    : pricing.confidence === "medium"
    ? { color: "#B8860B", background: "#B8860B15" }
    : { color: "#CC3333", background: "#CC333315" };

  // Market-shape sell-through from the raw comps stats — display-only context.
  const sellThroughLabel = demandLabel(comps.ebay?.stats.sellThrough);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="px-4 py-3">
        <p className="text-xs font-medium mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Suggested Price</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">$</span>
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handlePriceSubmit}
              onKeyDown={e => { if (e.key === "Enter") handlePriceSubmit(); }}
              className="text-2xl font-bold bg-transparent border-b-2 outline-none w-32"
              style={{ borderColor: "var(--flow-accent, #2D5A27)" }}
              step="0.01"
            />
          </div>
        ) : (
          <button onClick={() => { setEditValue(String(currentPrice)); setIsEditing(true); }} className="text-left">
            <span className="text-2xl font-bold">${currentPrice.toFixed(2)}</span>
            <span className="text-xs ml-2" style={{ color: "rgba(0,0,0,0.4)" }}>tap to change</span>
          </button>
        )}

        {pricing.basedOn > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm" style={{ color: "rgba(0,0,0,0.6)" }}>
              Range: ${pricing.low.toFixed(0)} — ${pricing.high.toFixed(0)}
            </p>
            <span className="text-xs px-1.5 py-0.5 rounded" style={confidenceStyle}>
              {pricing.basedOn} sold comps ({confidenceLabel})
            </span>
            {sellThroughLabel && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: "var(--teal, #1A7A6D)", background: "var(--teal-soft, rgba(26,122,109,0.1))" }}>
                {sellThroughLabel} demand
              </span>
            )}
          </div>
        )}

        {pricing.basedOn > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([
              { key: "Move it", value: pricing.low, pct: "25th pct" },
              { key: "Market", value: pricing.suggested, pct: "suggested" },
              { key: "Top dollar", value: pricing.high, pct: "75th pct" },
            ] as const).map(band => (
              <button
                key={band.key}
                onClick={() => onPriceChange(band.value)}
                className="rounded-lg px-2 py-2 text-left border transition-colors"
                style={{
                  // Same selected-band treatment as scan-flow's bands: teal
                  // tokens (redesign goal — never forest green in new code).
                  borderColor: currentPrice === band.value ? "var(--teal)" : "rgba(0,0,0,0.1)",
                  background: currentPrice === band.value ? "var(--teal-soft)" : "white",
                }}
              >
                <span className="block text-[11px] font-medium" style={{ color: "rgba(0,0,0,0.5)" }}>{band.key}</span>
                <span className="block text-sm font-bold">${band.value.toFixed(0)}</span>
                <span className="block text-[10px]" style={{ color: "rgba(0,0,0,0.4)" }}>{band.pct}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {comps.reverb && (
        <div className="flex border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {(["ebay", "reverb"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 text-sm font-medium text-center transition-colors"
              style={{
                color: activeTab === tab ? "var(--flow-accent, #2D5A27)" : "rgba(0,0,0,0.4)",
                borderBottom: activeTab === tab ? "2px solid var(--flow-accent, #2D5A27)" : "2px solid transparent",
              }}
            >
              {tab === "ebay" ? "eBay" : "Reverb"}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-3 max-h-48 overflow-y-auto">
        {activeTab === "ebay" && comps.ebay && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <p className="text-xs font-medium mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Sold</p>
            <p className="text-xs font-medium mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Active</p>
            {Array.from({ length: Math.max(comps.ebay.sold.length, comps.ebay.active.length) }).map((_, i) => (
              <div key={i} className="contents">
                <div className="text-sm py-0.5">
                  {comps.ebay!.sold[i] && (
                    <span>${comps.ebay!.sold[i].price.toFixed(0)} <span className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>{comps.ebay!.sold[i].condition}</span></span>
                  )}
                </div>
                <div className="text-sm py-0.5">
                  {comps.ebay!.active[i] && (
                    <span>${comps.ebay!.active[i].price.toFixed(0)} <span className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>{comps.ebay!.active[i].condition}</span></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "reverb" && comps.reverb && (
          <div className="space-y-1">
            {comps.reverb.listings.map((comp, i) => (
              <div key={i} className="text-sm py-0.5">
                ${comp.price.toFixed(0)} <span className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>{comp.condition}</span>
              </div>
            ))}
          </div>
        )}
        {pricing.basedOn === 0 && (
          <p className="text-sm text-center py-4" style={{ color: "rgba(0,0,0,0.4)" }}>No comps found for this item</p>
        )}
      </div>
    </div>
  );
}
