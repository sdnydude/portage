"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useShippingLabel } from "@/hooks/use-shipping";

// ─── Types ─────────────────────────────────────────────────

interface OrderDetail {
  id: string;
  listingId: string;
  itemId: string;
  marketplace: "ebay" | "etsy";
  marketplaceOrderId: string;
  buyerUsername: string;
  buyerAddress?: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  salePrice: number;
  shippingCost: number;
  marketplaceFees: number;
  currency: string;
  status: "payment_received" | "label_purchased" | "shipped" | "delivered";
  trackingNumber: string | null;
  carrier: string | null;
  shippingLabelUrl: string | null;
  soldAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  item: {
    id: string;
    title: string;
    photos: Array<{ url: string; isPrimary?: boolean }>;
    category: string;
  };
}

type OrderStatus = "payment_received" | "label_purchased" | "shipped" | "delivered";

// ─── Helpers ───────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "payment_received", label: "Payment Received" },
  { key: "label_purchased", label: "Label Purchased" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function getStatusIndex(status: OrderStatus): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function getMarketplaceBadge(marketplace: "ebay" | "etsy") {
  return marketplace === "ebay"
    ? { label: "eBay", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300" }
    : { label: "Etsy", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300" };
}

// ─── Page Component ────────────────────────────────────────

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const router = useRouter();
  const { token } = useAuth();
  const { markShipped } = useShippingLabel();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingShipped, setIsMarkingShipped] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<OrderDetail>(`/orders/${orderId}`, { token });
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load order");
    } finally {
      setIsLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleMarkShipped = async () => {
    setIsMarkingShipped(true);
    try {
      await markShipped(orderId);
      await fetchOrder();
    } catch {
      // Error handled by hook
    } finally {
      setIsMarkingShipped(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-dvh bg-background px-4 py-6">
        <div className="max-w-lg mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-text-secondary mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-300">
            {error ?? "Order not found"}
          </div>
        </div>
      </div>
    );
  }

  const badge = getMarketplaceBadge(order.marketplace);
  const primaryPhoto = order.item?.photos?.find((p) => p.isPrimary) ?? order.item?.photos?.[0];
  const currentStatusIndex = getStatusIndex(order.status);
  const profit = order.salePrice - order.shippingCost - order.marketplaceFees;

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            Order Details
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="px-4 pb-8 max-w-lg mx-auto">
        {/* Item card */}
        <section className="py-5">
          <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
            <div className="flex gap-3">
              {primaryPhoto ? (
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  <img src={primaryPhoto.url} alt={order.item?.title ?? "Item"} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary line-clamp-2">{order.item?.title ?? "Item"}</h3>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-1">Order #{order.marketplaceOrderId}</p>
                <p className="text-xs text-text-secondary">Sold {formatDate(order.soldAt)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Financials */}
        <section className="py-3">
          <h2 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3" style={{ fontSize: "var(--text-headline)" }}>
            Financials
          </h2>
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-2" style={{ boxShadow: "var(--shadow-subtle)" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Sale Price</span>
              <span className="text-sm font-medium text-text-primary">{formatCurrency(order.salePrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Shipping Cost</span>
              <span className="text-sm text-text-primary">-{formatCurrency(order.shippingCost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Marketplace Fees</span>
              <span className="text-sm text-text-primary">-{formatCurrency(order.marketplaceFees)}</span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Profit</span>
              <span className={`text-sm font-bold ${profit >= 0 ? "text-forest-green" : "text-accent-error"}`}>
                {formatCurrency(profit)}
              </span>
            </div>
          </div>
        </section>

        {/* Shipping status flow */}
        <section className="py-3">
          <h2 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3" style={{ fontSize: "var(--text-headline)" }}>
            Shipping Status
          </h2>
          <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
            <div className="space-y-0">
              {STATUS_STEPS.map((step, index) => {
                const isComplete = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                const isLast = index === STATUS_STEPS.length - 1;

                let dateStr: string | null = null;
                if (step.key === "payment_received" && order.soldAt) dateStr = formatDateTime(order.soldAt);
                if (step.key === "shipped" && order.shippedAt) dateStr = formatDateTime(order.shippedAt);
                if (step.key === "delivered" && order.deliveredAt) dateStr = formatDateTime(order.deliveredAt);

                return (
                  <div key={step.key} className="flex gap-3">
                    {/* Timeline dot and line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        isComplete
                          ? "bg-forest-green"
                          : "bg-border"
                      } ${isCurrent ? "ring-4 ring-forest-green-50" : ""}`} />
                      {!isLast && (
                        <div className={`w-0.5 h-8 ${isComplete && index < currentStatusIndex ? "bg-forest-green" : "bg-border"}`} />
                      )}
                    </div>
                    {/* Label */}
                    <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
                      <p className={`text-sm font-medium ${isComplete ? "text-text-primary" : "text-text-placeholder"}`}>
                        {step.label}
                      </p>
                      {dateStr && (
                        <p className="text-[11px] text-text-secondary mt-0.5">{dateStr}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tracking info */}
        {order.trackingNumber && (
          <section className="py-3">
            <h2 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3" style={{ fontSize: "var(--text-headline)" }}>
              Tracking
            </h2>
            <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Tracking Number</span>
                <span className="text-xs font-medium text-text-secondary">{order.carrier}</span>
              </div>
              <p className="font-[family-name:var(--font-jetbrains)] text-text-primary font-medium select-all" style={{ fontSize: "var(--text-body)" }}>
                {order.trackingNumber}
              </p>
            </div>
          </section>
        )}

        {/* Buyer info */}
        <section className="py-3">
          <h2 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3" style={{ fontSize: "var(--text-headline)" }}>
            Buyer
          </h2>
          <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
            <p className="text-sm font-medium text-text-primary">{order.buyerUsername}</p>
            {order.buyerAddress && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-sm text-text-primary">{order.buyerAddress.name}</p>
                <p className="text-sm text-text-secondary">{order.buyerAddress.street1}</p>
                {order.buyerAddress.street2 && (
                  <p className="text-sm text-text-secondary">{order.buyerAddress.street2}</p>
                )}
                <p className="text-sm text-text-secondary">
                  {order.buyerAddress.city}, {order.buyerAddress.state} {order.buyerAddress.zip}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Action buttons */}
        <section className="py-4 space-y-3">
          {order.status === "payment_received" && (
            <Link
              href={`/orders/${orderId}/ship`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-forest-green text-white font-semibold text-sm"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              Ship It
            </Link>
          )}

          {order.status === "label_purchased" && (
            <>
              {order.shippingLabelUrl && (
                <a
                  href={order.shippingLabelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border border-border bg-surface text-text-primary font-semibold text-sm hover:bg-muted transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  View Label
                </a>
              )}
              <button
                onClick={handleMarkShipped}
                disabled={isMarkingShipped}
                className="w-full py-3.5 rounded-2xl bg-forest-green text-white font-semibold text-sm disabled:opacity-60"
                style={{ boxShadow: "var(--shadow-elevated)" }}
              >
                {isMarkingShipped ? "Marking..." : "Mark as Shipped"}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
