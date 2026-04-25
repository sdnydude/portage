"use client";

import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-dashboard";
import Link from "next/link";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useDashboard();

  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-forest-green-50 flex items-center justify-center mb-6">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--forest-green)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1
            className="font-[family-name:var(--font-instrument)] font-bold text-text-primary mb-2"
            style={{ fontSize: "var(--text-title)" }}
          >
            Welcome to Portage
          </h1>
          <p className="text-text-secondary mb-6 max-w-xs" style={{ fontSize: "var(--text-body)" }}>
            AI-powered inventory and marketplace selling. Scan, list, and sell your items in seconds.
          </p>
          <Link
            href="/login"
            className="px-8 py-3 rounded-full bg-forest-green text-white font-semibold text-sm"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasItems = data.portfolio.totalItems > 0;
  const hasListings = data.recentListings.length > 0;
  const hasPendingShipments = data.pendingShipments.length > 0;

  return (
    <div className="px-4 pt-safe max-w-lg mx-auto">
      {/* Header with greeting + action icons */}
      <header className="flex items-center justify-between py-4">
        <div>
          <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
            {getGreeting()}
          </p>
          <h1
            className="font-[family-name:var(--font-instrument)] font-bold text-text-primary"
            style={{ fontSize: "var(--text-title)" }}
          >
            {data.displayName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/orders"
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-forest-green-50 transition-colors"
            aria-label="Orders"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-secondary"
            >
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </Link>
          <Link
            href="/more"
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-forest-green-50 transition-colors"
            aria-label="Settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-secondary"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="space-y-4 pb-6">
        {/* Portfolio Value Card */}
        {hasItems ? (
          <div
            className="rounded-2xl p-5 border border-forest-green-100"
            style={{
              background: "linear-gradient(135deg, var(--forest-green-50), var(--surface))",
              boxShadow: "var(--shadow-medium)",
            }}
          >
            <p className="text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>
              Portfolio Value
            </p>
            <p
              className="font-[family-name:var(--font-instrument)] font-bold text-text-primary"
              style={{ fontSize: "var(--text-display)" }}
            >
              {formatCurrency(data.portfolio.totalValueRecommended)}
            </p>
            <p className="text-text-secondary mt-1" style={{ fontSize: "var(--text-caption)" }}>
              {formatCurrency(data.portfolio.totalValueLow)} &ndash;{" "}
              {formatCurrency(data.portfolio.totalValueHigh)} range
            </p>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex-1">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Items
                </p>
                <p className="font-semibold text-text-primary" style={{ fontSize: "var(--text-headline)" }}>
                  {data.portfolio.totalItems}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Listed
                </p>
                <p className="font-semibold text-text-primary" style={{ fontSize: "var(--text-headline)" }}>
                  {data.stats.activeListings}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Sold
                </p>
                <p className="font-semibold text-text-primary" style={{ fontSize: "var(--text-headline)" }}>
                  {data.stats.soldListings}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 border border-border text-center"
            style={{ boxShadow: "var(--shadow-subtle)" }}
          >
            <div className="w-16 h-16 rounded-2xl bg-forest-green-50 flex items-center justify-center mx-auto mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--forest-green)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <h2
              className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-2"
              style={{ fontSize: "var(--text-headline)" }}
            >
              Start your inventory
            </h2>
            <p className="text-text-secondary mb-4" style={{ fontSize: "var(--text-body)" }}>
              Tap the Scan button below to photograph your first item. Porter will identify it instantly.
            </p>
          </div>
        )}

        {/* Pending Shipments */}
        {hasPendingShipments && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary"
                style={{ fontSize: "var(--text-headline)" }}
              >
                Needs Shipping
              </h2>
              <Link
                href="/orders"
                className="text-forest-green font-medium"
                style={{ fontSize: "var(--text-caption)" }}
              >
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {data.pendingShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border"
                  style={{ boxShadow: "var(--shadow-subtle)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {shipment.itemTitle}
                    </p>
                    <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                      {shipment.buyerUsername} &middot;{" "}
                      {shipment.marketplace === "ebay" ? "eBay" : "Etsy"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-semibold text-forest-green">
                      {formatCurrency(shipment.salePrice)}
                    </p>
                    <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                      {formatDate(shipment.soldAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Listings */}
        {hasListings && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary"
                style={{ fontSize: "var(--text-headline)" }}
              >
                Recent Listings
              </h2>
              <Link
                href="/listings"
                className="text-forest-green font-medium"
                style={{ fontSize: "var(--text-caption)" }}
              >
                View All
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {data.recentListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="flex-shrink-0 w-36 rounded-xl bg-surface border border-border overflow-hidden"
                  style={{ boxShadow: "var(--shadow-subtle)" }}
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {listing.itemPhotoUrl ? (
                      <img
                        src={listing.itemPhotoUrl}
                        alt={listing.itemTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-placeholder">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {listing.itemTitle}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-semibold text-forest-green">
                        {formatCurrency(listing.price)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                          listing.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : listing.status === "sold"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {listing.status === "active"
                          ? "Active"
                          : listing.status === "sold"
                            ? "Sold"
                            : "Draft"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {data.stats.totalOrders > 0 && (
          <div
            className="rounded-2xl p-4 border border-border"
            style={{ boxShadow: "var(--shadow-subtle)" }}
          >
            <h2
              className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3"
              style={{ fontSize: "var(--text-headline)" }}
            >
              Sales Summary
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Total Sales
                </p>
                <p className="font-semibold text-text-primary text-lg">
                  {data.stats.totalOrders}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Revenue
                </p>
                <p className="font-semibold text-forest-green text-lg">
                  {formatCurrency(data.stats.totalRevenue)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
