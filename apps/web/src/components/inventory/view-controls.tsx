"use client";

interface ViewControlsProps {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  total: number;
  category: string;
  onCategoryChange: (category: string) => void;
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

const categories = [
  { value: "", label: "All" },
  { value: "electronics", label: "Electronics" },
  { value: "clothing", label: "Clothing" },
  { value: "furniture", label: "Furniture" },
  { value: "collectibles", label: "Collectibles" },
  { value: "sports", label: "Sports" },
  { value: "home", label: "Home" },
  { value: "books", label: "Books" },
  { value: "toys", label: "Toys" },
  { value: "tools", label: "Tools" },
  { value: "jewelry", label: "Jewelry" },
  { value: "art", label: "Art" },
  { value: "music", label: "Music" },
  { value: "automotive", label: "Automotive" },
  { value: "other", label: "Other" },
];

export function ViewControls({ view, onViewChange, total, category, onCategoryChange, status = "", onStatusChange }: ViewControlsProps) {
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
        {categories.slice(0, 5).map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              category === cat.value
                ? "bg-forest-green text-white"
                : "bg-muted text-text-secondary hover:text-text-primary"
            }`}
          >
            {cat.label}
          </button>
        ))}
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-2 py-1 rounded-full text-xs bg-muted text-text-secondary border-none focus:outline-none cursor-pointer"
        >
          <option value="">More...</option>
          {categories.slice(5).map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
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
