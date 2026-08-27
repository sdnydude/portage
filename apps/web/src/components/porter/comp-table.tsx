"use client";

import { withKeys } from "@/lib/list-keys";

interface CompRow {
  source: string;
  condition: string;
  price: number;
  sold?: boolean;
}

interface CompTableProps {
  title: string;
  rows: CompRow[];
}

export function CompTable({ title, rows }: CompTableProps) {
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden text-sm">
      <div className="bg-[color-mix(in_srgb,var(--forest-green)_12%,transparent)] px-3 py-2 font-medium text-[var(--forest-green)]">
        {title}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {withKeys(rows, (row) => `${row.source}-${row.condition}-${row.price}-${row.sold ? "sold" : "active"}`).map(([key, row]) => (
          <div key={key} className="flex items-center gap-2 px-3 py-1.5">
            <span className="flex-1 text-[var(--text)]">{row.source}</span>
            <span className="flex-1 text-[var(--muted)] capitalize">{row.condition}</span>
            <span className={`font-jetbrains text-right ${row.sold ? "text-[var(--forest-green)]" : "text-[var(--text)]"}`}>
              {"$"}{row.price.toFixed(2)}
              {row.sold && <span className="ml-1 text-xs">(sold)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
