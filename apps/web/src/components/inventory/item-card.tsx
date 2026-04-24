import type { Item } from "@/hooks/use-items";
import Link from "next/link";

interface ItemCardProps {
  item: Item;
  view: "grid" | "list";
}

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function ItemCard({ item, view }: ItemCardProps) {
  const primaryPhoto = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
  const valueDisplay = item.estimatedValueMin && item.estimatedValueMax
    ? `$${item.estimatedValueMin}–$${item.estimatedValueMax}`
    : item.estimatedValueRecommended
      ? `~$${item.estimatedValueRecommended}`
      : null;

  if (view === "list") {
    return (
      <Link href={`/inventory/${item.id}`} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border hover:border-border-focus transition-colors">
        <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
          {primaryPhoto ? (
            <img src={primaryPhoto.url} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{item.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {item.category && (
              <span className="text-xs text-text-secondary">{item.category}</span>
            )}
            <span className="text-xs text-text-secondary">·</span>
            <span className="text-xs text-text-secondary">{conditionLabels[item.condition] ?? item.condition}</span>
          </div>
        </div>
        {valueDisplay && (
          <div className="text-sm font-medium text-forest-green flex-shrink-0">{valueDisplay}</div>
        )}
      </Link>
    );
  }

  return (
    <Link href={`/inventory/${item.id}`} className="bg-surface rounded-xl border border-border hover:border-border-focus transition-colors overflow-hidden">
      <div className="aspect-square bg-muted overflow-hidden">
        {primaryPhoto ? (
          <img src={primaryPhoto.url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-text-primary truncate">{item.title}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-text-secondary">{conditionLabels[item.condition] ?? item.condition}</span>
          {valueDisplay && (
            <span className="text-xs font-medium text-forest-green">{valueDisplay}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
