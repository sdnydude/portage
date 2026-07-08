"use client";

import Link from "next/link";
import { useOrders, type Order } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";

function primaryPhotoUrl(order: Order): string | null {
  const photos = order.itemPhotos;
  if (!photos || photos.length === 0) return null;
  return (photos.find((p) => p.isPrimary) ?? photos[0]).url;
}

function ItemThumb({ order }: { order: Order }) {
  const url = primaryPhotoUrl(order);
  const title = order.itemTitle ?? "Item";
  if (!url) {
    return (
      <div className="w-12 h-12 rounded-xl bg-forest-green-50 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={title} className="w-12 h-12 rounded-xl object-cover shrink-0" />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getStatusConfig(status: string) {
  switch (status) {
    case "payment_received":
      return { label: "Needs Shipping", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300" };
    case "label_purchased":
      return { label: "Label Ready", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300" };
    case "shipped":
      return { label: "Shipped", bg: "bg-forest-green-50", text: "text-forest-green" };
    case "delivered":
      return { label: "Delivered", bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-300" };
    default:
      return { label: status, bg: "bg-muted", text: "text-text-secondary" };
  }
}

function getMarketplaceBadge(marketplace: "ebay" | "etsy") {
  return marketplace === "ebay"
    ? { label: "eBay", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300" }
    : { label: "Etsy", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300" };
}

export default function OrdersPage() {
  const { isAuthenticated } = useAuth();
  const { orders, isLoading, error, syncOrders, isSyncing, syncError } = useOrders();

  const pendingOrders = orders.filter((o) => o.status === "payment_received");
  const otherOrders = orders.filter((o) => o.status !== "payment_received");

  if (!isAuthenticated) {
    return (
      <>
        <PageHeader title="Orders" />
        <div className="px-4 py-6 max-w-lg mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-text-secondary text-sm">Log in to view your orders</p>
            <Link href="/" className="mt-4 px-6 py-2.5 rounded-full bg-forest-green text-white text-sm font-medium">
              Log In
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Orders"
        action={
          <button
            onClick={() => syncOrders()}
            disabled={isSyncing}
            className="text-xs font-medium text-forest-green px-3 py-1.5 rounded-full bg-forest-green-50 hover:bg-forest-green-100 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? "animate-spin" : ""}>
              <path d="M21 12a9 9 0 11-6.219-8.56" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            {isSyncing ? "Syncing…" : "Sync"}
          </button>
        }
      />
      <div className="px-4 py-4 max-w-lg mx-auto">
        {syncError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-300 mb-4">
            Sync failed: {syncError}
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-forest-green-50 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-1" style={{ fontSize: "var(--text-headline)" }}>
              No orders yet
            </h3>
            <p className="text-sm text-text-secondary">Orders will appear here when your listings sell</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending shipments section */}
            {pendingOrders.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-2">
                  Needs Shipping ({pendingOrders.length})
                </h2>
                <div className="space-y-2">
                  {pendingOrders.map((order) => {
                    const status = getStatusConfig(order.status);
                    const badge = getMarketplaceBadge(order.marketplace);
                    return (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-surface p-4"
                        style={{ boxShadow: "var(--shadow-subtle)" }}
                      >
                        <Link href={`/orders/${order.id}`} className="flex items-center gap-3 mb-3">
                          <ItemThumb order={order} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {order.itemTitle ?? order.buyerUsername}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>
                                {status.label}
                              </span>
                              <span className="text-xs text-text-secondary">{formatDate(order.soldAt)}</span>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-instrument)] shrink-0">
                            {formatCurrency(order.salePrice)}
                          </p>
                        </Link>
                        {order.ebayItemId ? (
                          <a
                            href={`https://www.ebay.com/itm/${order.ebayItemId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center px-4 py-2 rounded-xl bg-forest-green text-white text-sm font-medium"
                          >
                            Ship It
                          </a>
                        ) : (
                          <Link
                            href={`/orders/${order.id}`}
                            className="block w-full text-center px-4 py-2 rounded-xl bg-forest-green text-white text-sm font-medium"
                          >
                            Ship It
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other orders */}
            {otherOrders.length > 0 && (
              <div>
                {pendingOrders.length > 0 && (
                  <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 mt-4">
                    All Orders
                  </h2>
                )}
                <div className="space-y-2">
                  {otherOrders.map((order) => {
                    const status = getStatusConfig(order.status);
                    const badge = getMarketplaceBadge(order.marketplace);
                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-muted"
                        style={{ boxShadow: "var(--shadow-subtle)" }}
                      >
                        <div className="flex items-center gap-3">
                          <ItemThumb order={order} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {order.itemTitle ?? order.buyerUsername}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>
                                {status.label}
                              </span>
                              <span className="text-xs text-text-secondary">{formatDate(order.soldAt)}</span>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-text-primary shrink-0">
                            {formatCurrency(order.salePrice)}
                          </p>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
