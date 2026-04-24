"use client";

import { useState } from "react";
import { useAdminApi } from "@/hooks/use-admin";

interface AdminOrder {
  id: string;
  marketplace: string;
  marketplaceOrderId: string;
  buyerUsername: string;
  salePrice: number;
  shippingCost: number;
  marketplaceFees: number;
  status: string;
  trackingNumber: string | null;
  soldAt: string;
}

interface RevenueData {
  allTime: { sales: number; fees: number; shipping: number; net: number; orders: number };
  thisMonth: { sales: number; fees: number; shipping: number; net: number; orders: number };
}

const statusLabels: Record<string, string> = { payment_received: "Paid", label_purchased: "Label Ready", shipped: "Shipped", delivered: "Delivered" };
const statusColors: Record<string, string> = {
  payment_received: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  label_purchased: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  shipped: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  delivered: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function RevCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-3 text-center">
      <div className="text-xs text-text-secondary uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-text-primary mt-0.5 font-[family-name:var(--font-instrument)]">{value}</div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const parts = [`?page=${page}&limit=25`];
  if (status) parts.push(`status=${status}`);

  const { data, isLoading } = useAdminApi<{ orders: AdminOrder[]; total: number; limit: number }>(`/orders${parts.join("&")}`, [status, page]);
  const { data: revenue } = useAdminApi<RevenueData>("/orders/revenue");
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">All Orders</h1>

      {revenue && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RevCard label="Total Sales" value={`$${revenue.allTime.sales.toLocaleString()}`} />
          <RevCard label="Fees" value={`$${revenue.allTime.fees.toLocaleString()}`} />
          <RevCard label="Net Revenue" value={`$${revenue.allTime.net.toLocaleString()}`} />
          <RevCard label="This Month" value={`$${revenue.thisMonth.sales.toLocaleString()}`} />
        </div>
      )}

      <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent">
        <option value="">All Status</option>
        <option value="payment_received">Paid</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
      </select>

      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Order ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Buyer</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Marketplace</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Sale</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Net</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>
              ))
            ) : data?.orders.map(order => (
              <tr key={order.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5 text-text-primary font-mono text-xs">{order.marketplaceOrderId}</td>
                <td className="px-4 py-2.5 text-text-primary">{order.buyerUsername}</td>
                <td className="px-4 py-2.5 text-text-secondary capitalize">{order.marketplace}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusColors[order.status] || ""}`}>{statusLabels[order.status] || order.status}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-text-primary font-medium">${order.salePrice.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right text-text-primary">${(order.salePrice - order.marketplaceFees - order.shippingCost).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{new Date(order.soldAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.orders.length === 0 && <div className="py-12 text-center text-sm text-text-placeholder">No orders yet</div>}
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
