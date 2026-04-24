"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminApi } from "@/hooks/use-admin";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "admin";
  subscriptionTier: "free" | "pro";
  aiScansThisMonth: number;
  bgRemovalsThisMonth: number;
  disabledAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  itemCount: number;
  activeListingCount: number;
  totalRevenue: number;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

function Badge({ children, color }: { children: React.ReactNode; color: "green" | "blue" | "amber" | "red" | "gray" }) {
  const colors = {
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    gray: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${colors[color]}`}>{children}</span>;
}

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const queryParts = [`?page=${page}&limit=25`];
  if (search) queryParts.push(`q=${encodeURIComponent(search)}`);
  if (roleFilter) queryParts.push(`role=${roleFilter}`);
  if (tierFilter) queryParts.push(`tier=${tierFilter}`);
  if (statusFilter) queryParts.push(`status=${statusFilter}`);
  const query = queryParts.join("&");

  const { data, isLoading, refetch } = useAdminApi<UsersResponse>(`/users${query}`, [search, roleFilter, tierFilter, statusFilter, page]);

  const handleAction = async (userId: string, action: string, body: Record<string, unknown>) => {
    if (!token) return;
    const confirmMsg = action === "delete"
      ? "Permanently delete this user and all their data? This cannot be undone."
      : `Confirm: ${action}?`;
    if (!confirm(confirmMsg)) return;

    try {
      if (action === "delete") {
        await api(`/admin/users/${userId}`, { method: "DELETE", token });
      } else {
        await api(`/admin/users/${userId}`, { method: "PATCH", body, token });
      }
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">Users</h1>
        {data && <div className="text-sm text-text-secondary">{data.total} total</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none w-64"
        />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent">
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Plan</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Items</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Listings</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Revenue</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">AI Usage</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-full" /></td></tr>
              ))
            ) : data?.users.map(user => (
              <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/users/${user.id}`} className="text-text-primary hover:text-forest-green font-medium">
                    {user.email}
                  </Link>
                  {user.displayName && <div className="text-xs text-text-placeholder">{user.displayName}</div>}
                </td>
                <td className="px-4 py-2.5"><Badge color={user.role === "admin" ? "blue" : "gray"}>{user.role}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={user.subscriptionTier === "pro" ? "green" : "gray"}>{user.subscriptionTier}</Badge></td>
                <td className="px-4 py-2.5 text-right text-text-primary">{user.itemCount}</td>
                <td className="px-4 py-2.5 text-right text-text-primary">{user.activeListingCount}</td>
                <td className="px-4 py-2.5 text-right text-text-primary">${user.totalRevenue.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{user.aiScansThisMonth} scans</td>
                <td className="px-4 py-2.5">
                  {user.disabledAt
                    ? <Badge color="red">Disabled</Badge>
                    : <Badge color="green">Active</Badge>
                  }
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {user.subscriptionTier === "free" ? (
                      <button onClick={() => handleAction(user.id, "upgrade", { subscriptionTier: "pro" })} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400">Pro</button>
                    ) : (
                      <button onClick={() => handleAction(user.id, "downgrade", { subscriptionTier: "free" })} className="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400">Free</button>
                    )}
                    {user.disabledAt ? (
                      <button onClick={() => handleAction(user.id, "enable", { disabled: false })} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400">Enable</button>
                    ) : (
                      <button onClick={() => handleAction(user.id, "disable", { disabled: true, disabledReason: prompt("Reason for disabling?") || "" })} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">Disable</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && data?.users.length === 0 && (
          <div className="py-12 text-center text-sm text-text-placeholder">No users match your filters</div>
        )}
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
