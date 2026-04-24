"use client";

import { useState } from "react";
import { useAdminApi } from "@/hooks/use-admin";

interface AuditEntry {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  user_role_changed: "Changed Role",
  user_tier_changed: "Changed Tier",
  user_disabled: "Disabled User",
  user_enabled: "Enabled User",
  user_deleted: "Deleted User",
  user_usage_reset: "Reset Usage",
  setting_updated: "Updated Setting",
};

const actionColors: Record<string, string> = {
  user_role_changed: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  user_tier_changed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  user_disabled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  user_enabled: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  user_deleted: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  user_usage_reset: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  setting_updated: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function DetailsSummary({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 text-xs text-text-placeholder space-x-3">
      {entries.map(([k, v]) => (
        <span key={k}><span className="text-text-secondary">{k}:</span> {String(v)}</span>
      ))}
    </div>
  );
}

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const parts = [`?page=${page}&limit=30`];
  if (action) parts.push(`action=${action}`);

  const { data, isLoading } = useAdminApi<{ entries: AuditEntry[]; total: number; limit: number }>(`/audit${parts.join("&")}`, [action, page]);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">Audit Log</h1>

      <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-muted rounded-lg text-sm text-text-primary border border-transparent">
        <option value="">All Actions</option>
        <option value="user_role_changed">Role Changes</option>
        <option value="user_tier_changed">Tier Changes</option>
        <option value="user_disabled">User Disabled</option>
        <option value="user_enabled">User Enabled</option>
        <option value="user_deleted">User Deleted</option>
        <option value="user_usage_reset">Usage Resets</option>
        <option value="setting_updated">Settings Updated</option>
      </select>

      <div className="bg-surface rounded-xl border border-border">
        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-64" /></div>
            ))
          ) : data?.entries.length ? (
            data.entries.map(entry => (
              <div key={entry.id} className="px-4 py-3 hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${actionColors[entry.action] || "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                      {actionLabels[entry.action] || entry.action}
                    </span>
                    <span className="text-sm text-text-primary">
                      {entry.targetType}{entry.targetId ? ` ${entry.targetId.slice(0, 8)}...` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary">{new Date(entry.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-1 text-xs text-text-placeholder">
                  by <span className="text-text-secondary">{entry.adminEmail}</span>
                </div>
                <DetailsSummary details={entry.details} />
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-text-placeholder">No audit entries yet</div>
          )}
        </div>
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
