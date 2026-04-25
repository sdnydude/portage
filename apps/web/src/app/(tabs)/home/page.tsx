"use client";

import Link from "next/link";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const { data, isLoading, error } = useDashboard();

  if (!isAuthenticated) {
    return <UnauthenticatedView />;
  }

  if (isLoading) {
    return (
      <div className="px-4 py-3 max-w-lg mx-auto">
        <GreetingHeader email={user?.email} />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 max-w-lg mx-auto">
        <GreetingHeader email={user?.email} />
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300 mt-4">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="px-4 py-3 max-w-lg mx-auto space-y-5 pb-6">
      <GreetingHeader email={user?.email} />
      <PortfolioCard portfolio={data.portfolio} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Active Listings"
          value={String(data.listings.active)}
          sub={data.listings.activeValue > 0 ? formatCurrency(data.listings.activeValue) : undefined}
          href="/listings"
          color="green"
        />
        <StatCard
          label="This Month"
          value={data.sales.ordersThisMonth > 0 ? formatCurrency(data.sales.netRevenueThisMonth) : "$0"}
          sub={data.sales.ordersThisMonth > 0 ? `${data.sales.ordersThisMonth} sale${data.sales.ordersThisMonth !== 1 ? "s" : ""}` : "No sales yet"}
          href="/orders"
          color="warm"
        />
      </div>
      <MomentumBar momentum={data.momentum} listings={data.listings} />
      <QuickActions unlistedItems={data.momentum.unlistedItems} />
      {data.recentItems.length > 0 && <RecentItems items={data.recentItems} />}
      {data.recentOrders.length > 0 && <RecentOrders orders={data.recentOrders} />}
    </div>
  );
}

function GreetingHeader({ email }: { email?: string | null }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = email?.split("@")[0]?.replace(/[._-]/g, " ") ?? null;

  return (
    <header className="pt-2 pb-1">
      <p className="text-sm text-text-secondary">{greeting}</p>
      <h1 className="text-2xl font-semibold font-[family-name:var(--font-instrument)] text-text-primary capitalize">
        {name || "Welcome back"}
      </h1>
    </header>
  );
}

function PortfolioCard({ portfolio }: { portfolio: DashboardData["portfolio"] }) {
  return (
    <div className="bg-gradient-to-br from-forest-green to-forest-green-dark rounded-2xl p-5 text-white">
      <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Portfolio Value</p>
      <p className="text-3xl font-bold font-[family-name:var(--font-instrument)] mt-1">
        {portfolio.estimatedValue.recommended > 0
          ? formatCurrency(portfolio.estimatedValue.recommended)
          : "$0"}
      </p>
      {portfolio.estimatedValue.low > 0 && (
        <p className="text-white/60 text-sm mt-1">
          Range: {formatCurrency(portfolio.estimatedValue.low)} – {formatCurrency(portfolio.estimatedValue.high)}
        </p>
      )}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
        <Link href="/inventory" className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors">
          <span>{portfolio.totalItems} item{portfolio.totalItems !== 1 ? "s" : ""}</span>
          <ChevronRight />
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, href, color }: {
  label: string;
  value: string;
  sub?: string;
  href: string;
  color: "green" | "warm";
}) {
  const dotColor = color === "green" ? "bg-forest-green" : "bg-accent-warm";
  return (
    <Link href={href} className="bg-surface rounded-xl border border-border p-4 hover:border-forest-green transition-colors block">
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <p className="text-xs text-text-secondary font-medium">{label}</p>
      </div>
      <p className="text-xl font-semibold font-[family-name:var(--font-instrument)] text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </Link>
  );
}

function MomentumBar({ momentum, listings }: {
  momentum: DashboardData["momentum"];
  listings: DashboardData["listings"];
}) {
  const tips: string[] = [];
  if (momentum.unlistedItems > 0) {
    tips.push(`${momentum.unlistedItems} item${momentum.unlistedItems !== 1 ? "s" : ""} ready to list`);
  }
  if (listings.drafts > 0) {
    tips.push(`${listings.drafts} draft${listings.drafts !== 1 ? "s" : ""} to publish`);
  }
  if (momentum.connectedMarketplaces.length === 0) {
    tips.push("Connect a marketplace to start selling");
  }

  if (tips.length === 0) return null;

  return (
    <div className="bg-forest-green-50 border border-forest-green-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <p className="text-sm font-semibold text-forest-green">Momentum</p>
      </div>
      <ul className="space-y-1">
        {tips.map((tip) => (
          <li key={tip} className="text-sm text-text-secondary flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-forest-green shrink-0" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickActions({ unlistedItems }: { unlistedItems: number }) {
  return (
    <div className="flex gap-3">
      <Link href="/inventory" className="flex-1 bg-surface rounded-xl border border-border p-3 flex items-center gap-3 hover:border-forest-green transition-colors">
        <div className="w-10 h-10 rounded-xl bg-forest-green-50 flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Inventory</p>
          <p className="text-xs text-text-secondary">View all items</p>
        </div>
      </Link>
      <Link href="/porter" className="flex-1 bg-surface rounded-xl border border-border p-3 flex items-center gap-3 hover:border-forest-green transition-colors">
        <div className="w-10 h-10 rounded-xl bg-forest-green-50 flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.2 4.7 3 6.3V21l3.5-2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Ask Porter</p>
          <p className="text-xs text-text-secondary">
            {unlistedItems > 0 ? "Get listing help" : "AI assistant"}
          </p>
        </div>
      </Link>
    </div>
  );
}

function RecentItems({ items }: { items: DashboardData["recentItems"] }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Recent Items</h2>
        <Link href="/inventory" className="text-xs text-forest-green font-medium">View all</Link>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const photo = (item.photos as { url: string; isPrimary?: boolean }[])?.find((p) => p.isPrimary) ?? (item.photos as { url: string }[])?.[0];
          return (
            <Link key={item.id} href={`/inventory/${item.id}`} className="flex items-center gap-3 bg-surface rounded-xl border border-border p-3 hover:border-forest-green transition-colors">
              <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                {photo ? (
                  <img src={photo.url} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                <p className="text-xs text-text-secondary">
                  {item.category || "Uncategorized"} · {timeAgo(item.createdAt)}
                </p>
              </div>
              {item.estimatedValueRecommended && (
                <p className="text-sm font-semibold text-forest-green shrink-0">
                  {formatCurrency(item.estimatedValueRecommended)}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RecentOrders({ orders }: { orders: DashboardData["recentOrders"] }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Recent Sales</h2>
        <Link href="/orders" className="text-xs text-forest-green font-medium">View all</Link>
      </div>
      <div className="space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center gap-3 bg-surface rounded-xl border border-border p-3">
            <div className="w-10 h-10 rounded-lg bg-accent-warm/10 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warm)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {formatCurrency(order.salePrice)}
              </p>
              <p className="text-xs text-text-secondary capitalize">
                {order.marketplace} · {order.buyerUsername} · {timeAgo(order.soldAt)}
              </p>
            </div>
            <StatusPill status={order.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    payment_received: "bg-accent-warning/10 text-accent-warning",
    label_purchased: "bg-accent-info/10 text-accent-info",
    shipped: "bg-forest-green-50 text-forest-green",
    delivered: "bg-forest-green-50 text-forest-green",
  };
  const labels: Record<string, string> = {
    payment_received: "Paid",
    label_purchased: "Label",
    shipped: "Shipped",
    delivered: "Delivered",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[status] ?? "bg-muted text-text-secondary"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function UnauthenticatedView() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-forest-green-50 flex items-center justify-center mb-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-instrument)] text-text-primary mb-2">
          Portage
        </h1>
        <p className="text-sm text-text-secondary max-w-xs mb-6">
          AI-powered inventory and multi-marketplace selling. Photograph, list, and sell your personal effects.
        </p>
        <Link href="/login" className="bg-forest-green text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-forest-green-light transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
