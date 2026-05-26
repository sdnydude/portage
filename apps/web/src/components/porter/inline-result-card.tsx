"use client";

import Link from "next/link";

interface ResultItem {
  id: string;
  title: string;
  photos?: Array<{ url: string; isPrimary?: boolean }>;
  estimatedValueRecommended?: number;
  estimatedValueMin?: number;
}

interface InlineResultCardProps {
  items: ResultItem[];
}

export function InlineResultCard({ items }: InlineResultCardProps) {
  const visible = items.slice(0, 3);

  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {visible.map((item) => {
        const photo = item.photos?.find((p) => p.isPrimary) ?? item.photos?.[0];
        const price = item.estimatedValueRecommended ?? item.estimatedValueMin;
        return (
          <Link
            key={item.id}
            href={`/inventory/${item.id}`}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 hover:bg-[var(--surface-hover)] transition-colors"
          >
            {photo ? (
              <img
                src={photo.url}
                alt={item.title}
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-[var(--muted-bg)] flex items-center justify-center text-xs text-[var(--muted)]">
                ?
              </div>
            )}
            <div className="max-w-[100px]">
              <div className="truncate text-xs font-medium">{item.title}</div>
              {price !== undefined && (
                <div className="font-jetbrains text-xs text-[var(--forest-green)]">
                  ${price}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
