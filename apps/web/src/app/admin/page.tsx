"use client";

import { useAdminApi } from "@/hooks/use-admin";

interface DashboardStats {
  users: { total: number; activeToday: number; newLastWeek: number };
  items: { total: number };
  listings: { active: number; total: number };
  orders: { thisMonth: number; revenueThisMonth: number };
}

interface ActivityEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function StatCard({ label, value, sub, color = "forest-green" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color === "forest-green" ? "text-forest-green" : "text-text-primary"} font-[family-name:var(--font-instrument)]`}>
        {value}
      </div>
      {sub && <div className="text-xs text-text-placeholder mt-0.5">{sub}</div>}
    </div>
  );
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = new Date(event.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });

  let icon: string;
  let label: string;
  let color: string;

  switch (event.type) {
    case "item_created":
      icon = "M12 4v16m8-8H4";
      label = `${event.data.title as string}`;
      color = "text-forest-green";
      break;
    case "order_placed":
      label = `$${event.data.salePrice} sale on ${event.data.marketplace}`;
      icon = "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z";
      color = "text-amber-600";
      break;
    case "user_registered":
      label = `${event.data.email as string} signed up`;
      icon = "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z";
      color = "text-blue-600";
      break;
    default:
      icon = "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
      label = event.type;
      color = "text-text-secondary";
  }

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={`mt-0.5 ${color}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{label}</div>
      </div>
      <div className="text-xs text-text-placeholder whitespace-nowrap">{date} {time}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminApi<DashboardStats>("/stats");
  const { data: activity, isLoading: activityLoading } = useAdminApi<ActivityEvent[]>("/activity?limit=10");

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">Dashboard</h1>

      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4 animate-pulse">
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-7 w-12 bg-muted rounded mt-2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Total Users" value={stats.users.total} sub={`${stats.users.newLastWeek} this week`} />
          <StatCard label="Active Today" value={stats.users.activeToday} />
          <StatCard label="Total Items" value={stats.items.total} />
          <StatCard label="Active Listings" value={stats.listings.active} sub={`of ${stats.listings.total} total`} />
          <StatCard label="Orders This Month" value={stats.orders.thisMonth} />
          <StatCard label="Revenue This Month" value={`$${stats.orders.revenueThisMonth.toLocaleString()}`} color="primary" />
        </div>
      ) : null}

      <div className="bg-surface rounded-xl border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Recent Activity</h2>
        </div>
        <div className="px-4 divide-y divide-border">
          {activityLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="py-3 animate-pulse">
                <div className="h-4 w-48 bg-muted rounded" />
              </div>
            ))
          ) : activity && activity.length > 0 ? (
            activity.map((event, i) => <ActivityItem key={i} event={event} />)
          ) : (
            <div className="py-8 text-center text-sm text-text-placeholder">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
