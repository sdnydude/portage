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
  subscriptionTier: "free" | "pro" | "beta-tester";
  aiScansThisMonth: number;
  aiListingsThisMonth: number;
  aiListingCredits: number;
  bgRemovalsThisMonth: number;
  trialEndsAt: string | null;
  limitOverrides: Partial<Record<"aiScansPerMonth" | "aiListingsPerMonth" | "bgRemovalsPerMonth", number | null>> | null;
  stripeSubscriptionId: string | null;
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

  // Whole-panel edit mode (item-detail precedent): one Save = one PATCH.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: "", role: "user", tier: "free", trialEndsAt: "", credits: "0", scans: "", listings: "", bgRemovals: "" });

  const startEdit = () => {
    if (!user) return;
    setForm({
      displayName: user.displayName ?? "",
      role: user.role,
      tier: user.subscriptionTier,
      trialEndsAt: user.trialEndsAt ? user.trialEndsAt.slice(0, 10) : "",
      credits: String(user.aiListingCredits),
      scans: user.limitOverrides?.aiScansPerMonth != null ? String(user.limitOverrides.aiScansPerMonth) : "",
      listings: user.limitOverrides?.aiListingsPerMonth != null ? String(user.limitOverrides.aiListingsPerMonth) : "",
      bgRemovals: user.limitOverrides?.bgRemovalsPerMonth != null ? String(user.limitOverrides.bgRemovalsPerMonth) : "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!token || !user) return;
    setActionLoading(true);
    try {
      const overrideOf = (v: string) => (v.trim() === "" ? undefined : Math.max(0, Math.round(Number(v))));
      // The backend replaces limitOverrides whole — start from the stored
      // object so keys this form doesn't show (porter, marketplaces) survive.
      const overrides: Record<string, number | null> = { ...(user.limitOverrides ?? {}) };
      for (const [key, v] of [["aiScansPerMonth", form.scans], ["aiListingsPerMonth", form.listings], ["bgRemovalsPerMonth", form.bgRemovals]] as const) {
        const n = overrideOf(v);
        if (n !== undefined && Number.isFinite(n)) overrides[key] = n;
        else delete overrides[key]; // blank = back to plan default
      }
      const body: Record<string, unknown> = {
        displayName: form.displayName.trim() === "" ? null : form.displayName.trim(),
        role: form.role,
        subscriptionTier: form.tier,
        aiListingCredits: Math.max(0, Math.round(Number(form.credits)) || 0),
        // Blank date clears the trial; blank overrides clear back to tier limits.
        trialEndsAt: form.trialEndsAt ? new Date(`${form.trialEndsAt}T00:00:00.000Z`).toISOString() : null,
        limitOverrides: Object.keys(overrides).length > 0 ? overrides : null,
      };
      await api(`/admin/users/${id}`, { method: "PATCH", body, token });
      setEditing(false);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
            {!editing && (
              <button onClick={startEdit} className="px-3 py-1 text-sm rounded-lg bg-forest-green-50 text-forest-green hover:bg-forest-green-100">Edit</button>
            )}
          </div>
          {editing ? (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-text-secondary block mb-1">Name</span>
                <input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm bg-surface" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-text-secondary block mb-1">Role</span>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm bg-surface">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-text-secondary block mb-1">Plan</span>
                  <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm bg-surface">
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                    <option value="beta-tester">beta-tester</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-text-secondary block mb-1">Trial ends (blank = no trial)</span>
                <input type="date" aria-label="Trial ends" value={form.trialEndsAt} onChange={e => setForm({ ...form, trialEndsAt: e.target.value })} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm bg-surface" />
              </label>
              <label className="block text-sm">
                <span className="text-text-secondary block mb-1">Listing credits</span>
                <input type="number" min={0} aria-label="Listing credits" value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm bg-surface" />
              </label>
              <div className="pt-1">
                <span className="text-text-secondary text-xs block mb-2">Monthly limit overrides — blank = plan default, 0 = blocked</span>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block text-xs">
                    <span className="text-text-secondary block mb-1">AI scans / month override</span>
                    <input type="number" min={0} aria-label="AI scans / month override" value={form.scans} onChange={e => setForm({ ...form, scans: e.target.value })} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm bg-surface" />
                  </label>
                  <label className="block text-xs">
                    <span className="text-text-secondary block mb-1">AI listings / month override</span>
                    <input type="number" min={0} aria-label="AI listings / month override" value={form.listings} onChange={e => setForm({ ...form, listings: e.target.value })} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm bg-surface" />
                  </label>
                  <label className="block text-xs">
                    <span className="text-text-secondary block mb-1">BG removals / month override</span>
                    <input type="number" min={0} aria-label="BG removals / month override" value={form.bgRemovals} onChange={e => setForm({ ...form, bgRemovals: e.target.value })} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm bg-surface" />
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button disabled={actionLoading} onClick={handleSave} className="px-3 py-1.5 text-sm rounded-lg bg-forest-green text-white disabled:opacity-50">Save changes</button>
                <button disabled={actionLoading} onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm rounded-lg bg-muted text-text-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Name" value={user.displayName || "—"} />
              <InfoRow label="Role" value={<span className={user.role === "admin" ? "text-blue-600" : ""}>{user.role}</span>} />
              <InfoRow label="Plan" value={<span className={user.subscriptionTier === "pro" ? "text-green-600" : ""}>{user.subscriptionTier}</span>} />
              <InfoRow label="Trial ends" value={user.trialEndsAt ? new Date(user.trialEndsAt).toLocaleDateString() : "—"} />
              <InfoRow label="Listing credits" value={user.aiListingCredits} />
              <InfoRow
                label="Limit overrides"
                value={user.limitOverrides && Object.keys(user.limitOverrides).length > 0
                  ? Object.entries(user.limitOverrides).map(([k, v]) => `${k.replace("PerMonth", "")}: ${v ?? "∞"}`).join(" · ")
                  : "plan defaults"}
              />
              <InfoRow label="Stripe" value={user.stripeSubscriptionId ? <span className="text-amber-600">Active subscription</span> : "—"} />
              <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
              <InfoRow label="Last Active" value={user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "Never"} />
              <InfoRow label="Status" value={user.disabledAt ? <span className="text-red-600">Archived: {user.disabledReason || "No reason"}</span> : <span className="text-green-600">Active</span>} />
            </>
          )}
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
          {user.marketplaceConnections.map((conn) => (
            <InfoRow
              key={`${conn.marketplace}-${conn.createdAt}`}
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
          {user.subscriptionTier !== "beta-tester" && (
            <button disabled={actionLoading} onClick={() => handleAction({ subscriptionTier: "beta-tester" }, "Move to the private Beta Tester tier (unlimited usage)?")} className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/20 dark:text-blue-400">Make Beta Tester</button>
          )}
          {user.subscriptionTier === "free" || user.subscriptionTier === "beta-tester" ? (
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
