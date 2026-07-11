"use client";

import { formatCurrency, formatCondition } from "@/lib/format";

interface PreviewItem {
  id: string;
  title: string;
  description: string;
  condition: string;
  photos: Array<{ key?: string; url: string; isPrimary?: boolean }>;
}

interface ListingPreviewShareCardProps {
  item: PreviewItem;
  price: number | null;
}

/**
 * Buyer-eye share card, no app chrome — the PNG capture target for the
 * preview page. Fixed 4:5 aspect so the captured composition is stable.
 * The hero image is served same-origin through the /img-cdn rewrite: R2's
 * public domain sends no CORS headers, and a cross-origin img taints the
 * canvas html-to-image serializes.
 */
export function ListingPreviewShareCard({ item, price }: ListingPreviewShareCardProps) {
  const hero = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
  // /img-cdn is the app's reverse proxy to the R2 public domain (next.config
  // rewrite) — same-origin, so the capture canvas can't taint.
  const heroSrc = hero?.key ? `/img-cdn/${hero.key}` : hero?.url;
  const excerpt =
    item.description.length > 200 ? `${item.description.slice(0, 200)}…` : item.description;

  return (
    <div
      className="w-full bg-surface border border-border rounded-2xl overflow-hidden flex flex-col"
      style={{ aspectRatio: "4 / 5" }}
    >
      <div className="relative flex-1 min-h-0 bg-muted">
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- capture target needs a plain img
          <img
            src={heroSrc}
            crossOrigin="anonymous"
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm">
            No photo
          </div>
        )}
      </div>
      <div className="p-4 space-y-1.5">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary leading-snug">
          {item.title}
        </h2>
        <div className="flex items-center gap-2">
          {price != null && (
            <span className="text-xl font-semibold text-text-primary">{formatCurrency(price)}</span>
          )}
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-text-secondary">
            {formatCondition(item.condition)}
          </span>
        </div>
        {excerpt && (
          <p className="text-xs text-text-secondary leading-relaxed">{excerpt}</p>
        )}
        <p className="text-[10px] uppercase tracking-wider text-(--teal) font-medium pt-1">
          Sold with Portage
        </p>
      </div>
    </div>
  );
}
