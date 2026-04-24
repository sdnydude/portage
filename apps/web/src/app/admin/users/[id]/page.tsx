"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAdminApi } from "@/hooks/use-admin";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface UserDetail {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "admin";
  subscriptionTier: "free" | "pro";
  aiScansThisMonth: number;
  bgRemovalsThisMonth: number;
  onboardingCompleted: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  itemCount: number;
  listingCount: number;
  orderCount: number;
  conversationCount: number;
  totalRevenue: number;
  marketplaceConnections: { marketplace: string; tokenExpiresAt: string; createdAt: string }[];
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-medium">{value}</span>
    </div>
  );
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const { data: user, isLoading, refetch } = useAdminApi<UserDetail>(`/users/${id}`);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (body: Record<string, unknown>, confirmMsg: string) => {
    if (!token || !confirm(confirmMsg)) return;
    setActionLoading(true);
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body, token });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetUsage = async () => {
    if (!token || !confirm("Reset all AI usage counters to zero?")) return;
    setActionLoading(true);
    try {
      await api(`/admin/users/${id}/reset-usage`, { method: "POST", token });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) return <div className="text-text-placeholder">User not found</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-text-secondary hover:text-text-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">{user.email}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Profile</h2>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Name" value={user.displayName || "—"} />
          <InfoRow label="Role" value={<span className={user.role === "admin" ? "text-blue-600" : ""}>{user.role}</span>} />
          <InfoRow label="Plan" value={<span className={user.subscriptionTier === "pro" ? "text-green-600" : ""}>{user.subscriptionTier}</span>} />
          <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
          <InfoRow label="Last Active" value={user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "Never"} />
          <InfoRow label="Status" value={user.disabledAt ? <span className="text-red-600">Disabled: {user.disabledReason || "No reason"}</span> : <span className="text-green-600">Active</span>} />
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Stats</h2>
          <InfoRow label="Items" value={user.itemCount} />
          <InfoRow label="Listings" value={user.listingCount} />
          <InfoRow label="Orders" value={user.orderCount} />
          <InfoRow label="Porter Conversations" value={user.conversationCount} />
          <InfoRow label="Total Revenue" value={`$${user.totalRevenue.toLocaleString()}`} />
          <InfoRow label="AI Scans This Month" value={user.aiScansThisMonth} />
          <InfoRow label="BG Removals This Month" value={user.bgRemovalsThisMonth} />
        </div>
      </div>

      {user.marketplaceConnections.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Marketplace Connections</h2>
          {user.marketplaceConnections.map((conn, i) => (
            <InfoRow
              key={i}
              label={conn.marketplace.toUpperCase()}
              value={
                <span className={new Date(conn.tokenExpiresAt) < new Date() ? "text-red-600" : "text-green-600"}>
                  {new Date(conn.tokenExpiresAt) < new Date() ? "Expired" : `Expires ${new Date(conn.tokenExpiresAt).toLocaleDateString()}`}
                </span>
              }
            />
          ))}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {user.subscriptionTier === "free" ? (
            <button disabled={actionLoading} onClick={() => handleAction({ subscriptionTier: "pro" }, "Upgrade to Pro plan?")} className="px-3 py-1.5 text-sm rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 dark:bg-green-900/20 dark:text-green-400">Upgrade to Pro</button>
          ) : (
            <button disabled={actionLoading} onClick={() => handleAction({ subscriptionTier: "free" }, "Downgrade to Free plan?")} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400">Downgrade to Free</button>
          )}
          {user.role === "user" ? (
            <button disabled={actionLoading} onClick={() => handleAction({ role: "admin" }, "Grant admin access?")} className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/20 dark:text-blue-400">Make Admin</button>
          ) : (
            <button disabled={actionLoading} onClick={() => handleAction({ role: "user" }, "Remove admin access?")} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400">Remove Admin</button>
          )}
          <button disabled={actionLoading} onClick={handleResetUsage} className="px-3 py-1.5 text-sm rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-900/20 dark:text-amber-400">Reset Usage</button>
          {user.disabledAt ? (
            <button disabled={actionLoading} onClick={() => handleAction({ disabled: false }, "Re-enable this account?")} className="px-3 py-1.5 text-sm rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 dark:bg-green-900/20 dark:text-green-400">Enable Account</button>
          ) : (
            <button disabled={actionLoading} onClick={() => handleAction({ disabled: true, disabledReason: prompt("Reason?") || "" }, "Disable this account?")} className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400">Disable Account</button>
          )}
        </div>
      </div>
    </div>
  );
}
