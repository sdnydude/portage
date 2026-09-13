"use client";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

interface PagerProps {
  page: number; // 1-based
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

/** Inventory pager: range text, previous/next, and a 25/50/100 page-size select. */
export function Pager({ page, pageSize, total, onPageChange, onPageSizeChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm text-text-secondary">
      <span>{first}–{last} of {total}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="sr-only">Items per page</span>
          <select
            aria-label="Items per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="rounded-lg bg-muted px-2 py-1 text-text-primary"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </label>
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-lg bg-muted px-3 py-1 disabled:opacity-40">‹</button>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="rounded-lg bg-muted px-3 py-1 disabled:opacity-40">›</button>
      </div>
    </div>
  );
}
