"use client";

import { useState } from "react";
import { useAdminApi } from "@/hooks/use-admin";

interface AdminItem {
  id: string;
  userId: string;
  title: string;
  category: string;
  condition: string;
  brand: string;
  model: string;
  photos: { url: string }[];
  estimatedValueMin: number | null;
  estimatedValueMax: number | null;
  estimatedValueRecommended: number | null;
  aiConfidenceScore: number;
  createdAt: string;
}

export default function AdminInventoryPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = `?page=${page}&limit=25${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  const { data, isLoading } = useAdminApi<{ items: AdminItem[]; total: number; page: number; limit: number }>(`/items${query}`, [search, page]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">All Inventory</h1>
        {data && <div className="text-sm text-text-secondary">{data.total} items</div>}
      </div>

      <input type="text" placeholder="Search by title, brand, or model..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none w-72" />

      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Item</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Condition</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Est. Value</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">AI Score</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>
              ))
            ) : data?.items.map(item => (
              <tr key={item.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {item.photos[0] && <img src={item.photos[0].url} alt="" className="w-8 h-8 rounded object-cover" />}
                    <div>
                      <div className="text-text-primary font-medium">{item.title}</div>
                      {item.brand && <div className="text-xs text-text-placeholder">{item.brand} {item.model}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-text-secondary capitalize">{item.category || "—"}</td>
                <td className="px-4 py-2.5 text-text-secondary capitalize">{item.condition.replace("_", " ")}</td>
                <td className="px-4 py-2.5 text-right text-text-primary">
                  {item.estimatedValueRecommended ? `$${item.estimatedValueRecommended}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={item.aiConfidenceScore >= 0.8 ? "text-green-600" : item.aiConfidenceScore >= 0.5 ? "text-amber-600" : "text-red-600"}>
                    {(item.aiConfidenceScore * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{new Date(item.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.items.length === 0 && <div className="py-12 text-center text-sm text-text-placeholder">No items found</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm rounded-lg bg-muted text-text-secondary disabled:opacity-30">Previous</button>
          <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm rounded-lg bg-muted text-text-secondary disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
