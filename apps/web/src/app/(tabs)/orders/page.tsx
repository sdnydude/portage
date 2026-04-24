"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import type { Order } from "@/hooks/use-orders";

const statusLabels: Record<string, string> = {
  payment_received: "Payment Received",
  label_purchased: "Label Purchased",
  shipped: "Shipped",
  delivered: "Delivered",
};

const statusColors: Record<string, string> = {
  payment_received: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  label_purchased: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  shipped: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function OrderCard({ order }: { order: Order }) {
  return (
    <div className="p-3 bg-surface rounded-xl border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[order.status]}`}>
          {statusLabels[order.status]}
        </span>
        <span className="text-[10px] font-medium text-text-secondary uppercase">
          {order.marketplace === "ebay" ? "eBay" : "Etsy"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-text-primary">${order.salePrice.toFixed(2)}</div>
          <div className="text-xs text-text-secondary mt-0.5">Buyer: {order.buyerUsername}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-secondary">{new Date(order.soldAt).toLocaleDateString()}</div>
          {order.trackingNumber && (
            <div className="text-xs text-forest-green mt-0.5">{order.carrier}: {order.trackingNumber}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const { orders, isLoading, error, syncOrders } = useOrders(statusFilter || undefined);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncOrders();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <PageHeader title="Orders" />
        <div className="px-4 py-6 max-w-lg mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-text-secondary">Sign in to manage orders.</p>
          </div>
        </div>
      </>
    );
  }

  const filters = [
    { value: "", label: "All" },
    { value: "payment_received", label: "Pending" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        action={
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg bg-forest-green text-white text-xs font-medium disabled:opacity-50"
          >
            {isSyncing ? "Syncing..." : "Sync"}
          </button>
        }
      />
      <div className="px-4 py-3 max-w-lg mx-auto space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? "bg-forest-green text-white"
                  : "bg-muted text-text-secondary hover:text-text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-forest-green-50 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary mb-2">
              No orders yet
            </h2>
            <p className="text-sm text-text-secondary max-w-xs">
              When your listings sell, orders appear here. Tap Sync to check for new sales.
            </p>
          </div>
        )}

        {!isLoading && !error && orders.length > 0 && (
          <div className="flex flex-col gap-2">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
