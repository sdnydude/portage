import type { Item } from "@/hooks/use-items";
import Link from "next/link";
import { formatCondition } from "@/lib/format";

interface ItemCardProps {
  item: Item;
  view: "grid" | "list";
  onOpen?: () => void;
  selected?: boolean;
}

export function ItemCard({ item, view, onOpen, selected }: ItemCardProps) {
  const primaryPhoto = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
  const valueDisplay = item.estimatedValueMin && item.estimatedValueMax
    ? `$${item.estimatedValueMin}–$${item.estimatedValueMax}`
    : item.estimatedValueRecommended
      ? `~$${item.estimatedValueRecommended}`
      : null;

  const className =
    view === "list"
      ? "flex items-center gap-3 p-3 bg-surface rounded-xl border border-border hover:border-border-focus transition-colors"
      : "block bg-surface rounded-xl border border-border hover:border-border-focus transition-colors overflow-hidden";

  const content = view === "list" ? (
    <>
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
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{item.title}</div>
          {item.listed === false && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--teal, #1A7A6D)", background: "var(--teal-soft, rgba(26,122,109,0.1))" }}>Unlisted</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {item.category && (
            <span className="text-xs text-text-secondary">{item.category}</span>
          )}
          <span className="text-xs text-text-secondary">·</span>
          <span className="text-xs text-text-secondary">{formatCondition(item.condition)}</span>
        </div>
      </div>
      {valueDisplay && (
        <div className="text-sm font-medium text-forest-green flex-shrink-0">{valueDisplay}</div>
      )}
    </>
  ) : (
    <>
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
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{item.title}</div>
          {item.listed === false && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--teal, #1A7A6D)", background: "var(--teal-soft, rgba(26,122,109,0.1))" }}>Unlisted</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-text-secondary">{formatCondition(item.condition)}</span>
          {valueDisplay && (
            <span className="text-xs font-medium text-forest-green">{valueDisplay}</span>
          )}
        </div>
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-item-id={item.id}
        aria-current={selected ? "true" : undefined}
        className={`${className} w-full text-left ${selected ? "ring-2 ring-forest-green border-transparent" : ""}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={`/inventory/${item.id}`} className={className}>
      {content}
    </Link>
  );
}
