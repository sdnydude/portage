"use client";

/**
 * Shared status + marketplace chips (Housekeeping-1). Colors come from the
 * --chip-* tokens in globals.css (light + dark pairs, each ≥ 6:1) so every
 * surface — listings page, inventory cards, item detail — reads the same.
 */
export type ItemDisplayStatus = "active" | "draft" | "unlisted" | "asset" | "sold" | "archived";

const STATUS: Record<ItemDisplayStatus, { label: string; tone: "active" | "draft" | "sold" | "neutral" | "asset" }> = {
  active: { label: "Active", tone: "active" },
  draft: { label: "Draft", tone: "draft" },
  unlisted: { label: "Unlisted", tone: "neutral" },
  asset: { label: "Asset", tone: "asset" },
  sold: { label: "Sold", tone: "sold" },
  archived: { label: "Archived", tone: "neutral" },
};

const MARKETPLACE: Record<string, string> = { ebay: "eBay", reverb: "Reverb", etsy: "Etsy" };

const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap";

export function StatusChip({ status, className = "" }: { status: ItemDisplayStatus; className?: string }) {
  const s = STATUS[status] ?? STATUS.unlisted;
  return (
    <span
      className={`${base} ${className}`}
      style={{ color: `var(--chip-${s.tone}-fg)`, background: `var(--chip-${s.tone}-bg)` }}
    >
      {s.label}
    </span>
  );
}

export function MarketplaceChip({ marketplace, className = "" }: { marketplace: string; className?: string }) {
  return (
    <span
      className={`${base} border ${className}`}
      style={{ color: "var(--text-secondary)", borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {MARKETPLACE[marketplace] ?? marketplace}
    </span>
  );
}
