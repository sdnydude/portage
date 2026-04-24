"use client";

import { useState, useEffect } from "react";
import { useAdminApi } from "@/hooks/use-admin";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface SettingsMap {
  [key: string]: unknown;
}

const settingsMeta: { key: string; label: string; description: string; type: "number" | "boolean" }[] = [
  { key: "free_tier_scan_limit", label: "Free Tier: AI Scans / Month", description: "Max AI scans for free users", type: "number" },
  { key: "free_tier_bg_removal_limit", label: "Free Tier: BG Removals / Month", description: "Max background removals for free users", type: "number" },
  { key: "free_tier_marketplace_limit", label: "Free Tier: Marketplaces", description: "Max marketplace connections for free users", type: "number" },
  { key: "free_tier_porter_daily_limit", label: "Free Tier: Porter Messages / Day", description: "Max Porter AI messages per day for free users", type: "number" },
  { key: "registration_open", label: "Registration Open", description: "Allow new user signups", type: "boolean" },
  { key: "maintenance_mode", label: "Maintenance Mode", description: "Show maintenance page to non-admin users", type: "boolean" },
  { key: "ebay_enabled", label: "eBay Integration", description: "Allow eBay marketplace connections", type: "boolean" },
  { key: "etsy_enabled", label: "Etsy Integration", description: "Allow Etsy marketplace connections", type: "boolean" },
  { key: "porter_enabled", label: "Porter AI", description: "Enable the Porter AI assistant", type: "boolean" },
];

function SettingRow({ meta, value, onSave }: { meta: typeof settingsMeta[0]; value: unknown; onSave: (key: string, value: unknown) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(String(value)); }, [value]);

  const handleSave = async () => {
    setSaving(true);
    const parsed = meta.type === "number" ? Number(draft) : draft === "true";
    await onSave(meta.key, parsed);
    setEditing(false);
    setSaving(false);
  };

  if (meta.type === "boolean") {
    const isOn = value === true || value === "true";
    return (
      <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
        <div>
          <div className="text-sm font-medium text-text-primary">{meta.label}</div>
          <div className="text-xs text-text-placeholder">{meta.description}</div>
        </div>
        <button
          onClick={async () => {
            setSaving(true);
            await onSave(meta.key, !isOn);
            setSaving(false);
          }}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors ${isOn ? "bg-forest-green" : "bg-zinc-300 dark:bg-zinc-600"} ${saving ? "opacity-50" : ""}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isOn ? "translate-x-5" : ""}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <div className="text-sm font-medium text-text-primary">{meta.label}</div>
        <div className="text-xs text-text-placeholder">{meta.description}</div>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" value={draft} onChange={e => setDraft(e.target.value)}
            className="w-20 px-2 py-1 bg-muted rounded text-sm text-text-primary border border-border-focus text-right" />
          <button onClick={handleSave} disabled={saving} className="text-xs px-2 py-1 rounded bg-forest-green text-white disabled:opacity-50">Save</button>
          <button onClick={() => { setEditing(false); setDraft(String(value)); }} className="text-xs px-2 py-1 rounded bg-muted text-text-secondary">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm text-text-primary font-medium hover:text-forest-green">
          {String(value)}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-placeholder">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const { data, isLoading, refetch } = useAdminApi<SettingsMap>("/settings");

  const handleSave = async (key: string, value: unknown) => {
    if (!token) return;
    try {
      await api(`/admin/settings/${key}`, { method: "PATCH", body: { value }, token });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">App Settings</h1>

      <div className="bg-surface rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Tier Limits</h2>
        {isLoading ? (
          <div className="h-40 bg-muted rounded animate-pulse" />
        ) : data ? (
          settingsMeta.filter(m => m.type === "number").map(meta => (
            <SettingRow key={meta.key} meta={meta} value={data[meta.key]} onSave={handleSave} />
          ))
        ) : null}
      </div>

      <div className="bg-surface rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Feature Flags</h2>
        {isLoading ? (
          <div className="h-40 bg-muted rounded animate-pulse" />
        ) : data ? (
          settingsMeta.filter(m => m.type === "boolean").map(meta => (
            <SettingRow key={meta.key} meta={meta} value={data[meta.key]} onSave={handleSave} />
          ))
        ) : null}
      </div>
    </div>
  );
}
