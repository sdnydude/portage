"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const NOTIFICATION_TYPES = [
  { key: "sale", label: "Sales", description: "When an item sells on any marketplace" },
  { key: "buyer_message", label: "Buyer Messages", description: "New messages from buyers" },
  { key: "listing_expiry", label: "Listing Expiry", description: "When a listing is about to expire" },
  { key: "price_alert", label: "Price Alerts", description: "Significant price changes for your items" },
  { key: "shipping_reminder", label: "Shipping Reminders", description: "Reminders to ship sold items" },
] as const;

type NotificationPrefs = Record<string, boolean>;

export default function NotificationsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ notificationPreferences: NotificationPrefs | null }>("/users/me", { token })
      .then((data) => {
        const defaults: NotificationPrefs = {};
        NOTIFICATION_TYPES.forEach((t) => {
          defaults[t.key] = data.notificationPreferences?.[t.key] ?? true;
        });
        setPrefs(defaults);
      })
      .catch(() => setError("Failed to load notification preferences"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleToggle = async (key: string) => {
    if (!token) return;
    const previousValue = prefs[key];
    const updated = { ...prefs, [key]: !previousValue };
    setPrefs(updated);
    setSaving(true);
    setMessage(null);
    try {
      await api("/users/me", {
        method: "PATCH",
        body: { notificationPreferences: updated },
        token,
      });
      setMessage("Saved");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: previousValue }));
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1 -ml-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Notifications</h1>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-forest-green border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-accent-error bg-red-50 dark:bg-red-950/30 p-4 text-sm text-accent-error">
            {error}
          </div>
        ) : (
          <div className="space-y-2">
            {NOTIFICATION_TYPES.map((type) => (
              <div
                key={type.key}
                className="flex items-center justify-between p-4 rounded-2xl border border-border bg-surface"
                style={{ boxShadow: "var(--shadow-subtle)" }}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <h3 className="text-sm font-semibold text-text-primary">{type.label}</h3>
                  <p className="text-xs text-text-secondary mt-0.5">{type.description}</p>
                </div>
                <button
                  onClick={() => handleToggle(type.key)}
                  disabled={saving}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    prefs[type.key] ? "bg-forest-green" : "bg-border"
                  }`}
                  role="switch"
                  aria-checked={prefs[type.key]}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      prefs[type.key] ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {message && (
          <p className={`text-center text-sm mt-4 ${message === "Saved" ? "text-forest-green" : "text-accent-error"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
