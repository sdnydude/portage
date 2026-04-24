"use client";

import { useState } from "react";
import { useAdminApi } from "@/hooks/use-admin";

interface AdminListing {
  id: string;
  itemId: string;
  userId: string;
  marketplace: "ebay" | "etsy";
  status: "draft" | "active" | "sold" | "archived";
  price: number;
  currency: string;
  createdAt: string;
  publishedAt: string | null;
  soldAt: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  sold: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  archived: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminListingsPage() {
  const [status, setStatus] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [page, setPage] = useState(1);

  const parts = [`?page=${page}&limit=25`];
  if (status) parts.push(`status=${status}`);
  if (marketplace) parts.push(`marketplace=${marketplace}`);

  const { data, isLoading } = useAdminApi<{ listings: AdminListing[]; total: number; limit: number }>(`/listings${parts.join("&")}`, [status, marketplace, page]);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">All Listings</h1>
        {data && <div className="text-sm text-text-secondary">{data.total} total</div>}
      </div>

      <div className="flex gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="archived">Archived</option>
        </select>
        <select value={marketplace} onChange={e => { setMarketplace(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent">
          <option value="">All Marketplaces</option>
          <option value="ebay">eBay</option>
          <option value="etsy">Etsy</option>
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Marketplace</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Price</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Created</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>
              ))
            ) : data?.listings.map(listing => (
              <tr key={listing.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5 text-text-primary capitalize">{listing.marketplace}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusColors[listing.status]}`}>{listing.status}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-text-primary font-medium">${listing.price.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{new Date(listing.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{listing.publishedAt ? new Date(listing.publishedAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.listings.length === 0 && <div className="py-12 text-center text-sm text-text-placeholder">No listings yet — they&apos;ll show up here when users start selling</div>}
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
