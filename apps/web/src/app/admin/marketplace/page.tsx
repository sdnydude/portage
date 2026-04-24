"use client";

import { useAdminApi } from "@/hooks/use-admin";

interface MarketplaceAccount {
  id: string;
  userId: string;
  marketplace: "ebay" | "etsy";
  tokenExpiresAt: string;
  createdAt: string;
  status: "healthy" | "expiring" | "expired";
}

interface MarketplaceHealth {
  accounts: MarketplaceAccount[];
  summary: {
    ebay: { total: number; healthy: number; expiring: number; expired: number };
    etsy: { total: number; healthy: number; expiring: number; expired: number };
  };
}

const statusBadge: Record<string, string> = {
  healthy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  expiring: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function SummaryCard({ name, data }: { name: string; data: { total: number; healthy: number; expiring: number; expired: number } }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-text-primary capitalize mb-3">{name}</h3>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div><div className="text-lg font-bold text-text-primary">{data.total}</div><div className="text-[10px] text-text-secondary uppercase">Total</div></div>
        <div><div className="text-lg font-bold text-green-600">{data.healthy}</div><div className="text-[10px] text-text-secondary uppercase">Healthy</div></div>
        <div><div className="text-lg font-bold text-amber-600">{data.expiring}</div><div className="text-[10px] text-text-secondary uppercase">Expiring</div></div>
        <div><div className="text-lg font-bold text-red-600">{data.expired}</div><div className="text-[10px] text-text-secondary uppercase">Expired</div></div>
      </div>
    </div>
  );
}

export default function AdminMarketplacePage() {
  const { data, isLoading } = useAdminApi<MarketplaceHealth>("/marketplace/health");

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">Marketplace Health</h1>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryCard name="eBay" data={data.summary.ebay} />
          <SummaryCard name="Etsy" data={data.summary.etsy} />
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">All Connections</h2>
        </div>
        {isLoading ? (
          <div className="p-4"><div className="h-20 bg-muted rounded animate-pulse" /></div>
        ) : data?.accounts.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Marketplace</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Connected</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Expires</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.accounts.map(a => (
                <tr key={a.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 text-text-primary font-mono text-xs">{a.userId.slice(0, 8)}...</td>
                  <td className="px-4 py-2.5 text-text-primary capitalize">{a.marketplace}</td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">{new Date(a.tokenExpiresAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusBadge[a.status]}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-sm text-text-placeholder">No marketplace connections yet</div>
        )}
      </div>
    </div>
  );
}
