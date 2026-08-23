"use client";

import type { ItemCategory } from "@/hooks/use-items";

interface ViewControlsProps {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  total: number;
  category: string;
  onCategoryChange: (category: string) => void;
  /** The inventory's own categories (GET /items/categories) — items.category
   *  holds the eBay leaf name, so a static bucket list matched nothing. */
  categories?: ItemCategory[];
  /** Derived item status filter (Housekeeping-1 T6). "" = all. */
  status?: string;
  onStatusChange?: (status: string) => void;
}

const statuses = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "unlisted", label: "Unlisted" },
  { value: "asset", label: "Asset" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
];


export function ViewControls({ view, onViewChange, total, category, onCategoryChange, categories = [], status = "", onStatusChange }: ViewControlsProps) {
  const chips = [{ value: "", label: "All", count: null as number | null }, ...categories];
  return (
    <div className="space-y-2">
    {onStatusChange && (
      <div role="group" aria-label="Filter by status" className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
        {statuses.map((st) => (
          <button
            key={st.value}
            type="button"
            aria-pressed={status === st.value}
            onClick={() => onStatusChange(st.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              status === st.value
                ? "bg-forest-green text-white"
                : "bg-muted text-text-secondary hover:text-text-primary"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>
    )}
    <div className="flex items-center justify-between">
      <div role="group" aria-label="Filter by category" className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
        {chips.map((cat) => (
          <button
            key={cat.value}
            type="button"
            aria-pressed={category === cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              category === cat.value
                ? "bg-forest-green text-white"
                : "bg-muted text-text-secondary hover:text-text-primary"
            }`}
          >
            {cat.label}{cat.count != null && <span className="ml-1 opacity-70">{` ${cat.count}`}</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <span className="text-xs text-text-secondary mr-1">{total}</span>
        <button
          onClick={() => onViewChange("grid")}
          className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "bg-forest-green-50 text-forest-green" : "text-text-secondary"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="13" y="3" width="8" height="8" rx="1" />
            <rect x="3" y="13" width="8" height="8" rx="1" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
          </svg>
        </button>
        <button
          onClick={() => onViewChange("list")}
          className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "bg-forest-green-50 text-forest-green" : "text-text-secondary"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <rect x="3" y="10" width="18" height="4" rx="1" />
            <rect x="3" y="16" width="18" height="4" rx="1" />
          </svg>
        </button>
      </div>
    </div>
    </div>
  );
}
