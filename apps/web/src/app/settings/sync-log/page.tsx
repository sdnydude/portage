"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatMarketplace } from "@/lib/format";

const PAGE_SIZE = 25;

interface SyncLogEntry {
  id: string;
  itemId: string | null;
  listingId: string | null;
  marketplace: "ebay" | "etsy" | "reverb";
  trigger: string;
  status: "success" | "failure";
  message: string | null;
  errors: unknown;
  durationMs: number | null;
  createdAt: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  item_edit: "Item edit",
  listing_edit: "Listing edit",
  photo: "Photo update",
  publish: "Publish",
  mass_sync: "Full sync",
};

export default function SyncLogPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [entries, setEntries] = useState<SyncLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryNote, setRetryNote] = useState<string | null>(null);

  const load = useCallback(async (nextOffset: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ entries: SyncLogEntry[]; total: number }>(
        `/sync-log?limit=${PAGE_SIZE}&offset=${nextOffset}`,
        { token },
      );
      setEntries(res.entries);
      setTotal(res.total);
      setOffset(nextOffset);
    } catch {
      setError("Failed to load the sync log");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load(0);
  }, [load]);

  const handleRetry = async (entry: SyncLogEntry) => {
    if (!token || !entry.listingId) return;
    setRetryingId(entry.id);
    setRetryNote(null);
    try {
      await api("/sync-log/retry", { method: "POST", body: { listingId: entry.listingId }, token });
      setRetryNote("Sync queued — it will appear here once it runs.");
    } catch {
      setRetryNote("Could not queue the retry — the listing may no longer be syncable.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button aria-label="Back" onClick={() => router.back()} className="p-1 text-text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-text-primary">Marketplace Sync Log</h1>
        </div>

        {retryNote && (
          <div className="mb-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-sm text-blue-700 dark:text-blue-300">
            {retryNote}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
            {error}
            <button onClick={() => void load(offset)} className="underline">Try again</button>
          </div>
        )}

        {loading && entries.length === 0 ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No sync activity yet. Edits to listed items appear here after they push to eBay or Reverb.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="bg-surface border border-border rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                        entry.status === "success"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      }`}
                    >
                      {entry.status === "success" ? "Success" : "Failed"}
                    </span>
                    <span className="text-sm font-medium text-text-primary truncate">
                      {formatMarketplace(entry.marketplace)} · {TRIGGER_LABELS[entry.trigger] ?? entry.trigger}
                    </span>
                  </div>
                  <span className="text-xs text-text-secondary shrink-0">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                {entry.message && (
                  <p className="mt-1.5 text-sm text-text-secondary">{entry.message}</p>
                )}
                <div className="mt-1.5 flex items-center gap-3">
                  {entry.itemId && (
                    <a href={`/inventory/${entry.itemId}`} className="text-xs text-(--teal) underline underline-offset-2">
                      View item
                    </a>
                  )}
                  {entry.status === "failure" && entry.errors != null && (
                    <button
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      className="text-xs text-text-secondary underline underline-offset-2"
                    >
                      {expandedId === entry.id ? "Hide details" : "Show details"}
                    </button>
                  )}
                  {entry.status === "failure" && entry.listingId && (
                    <button
                      onClick={() => void handleRetry(entry)}
                      disabled={retryingId === entry.id}
                      className="text-xs font-medium text-(--teal) underline underline-offset-2 disabled:opacity-50"
                    >
                      {retryingId === entry.id ? "Queuing…" : "Retry sync"}
                    </button>
                  )}
                </div>
                {expandedId === entry.id && (
                  <pre className="mt-2 p-2 rounded-lg bg-background border border-border text-xs overflow-x-auto">
                    {JSON.stringify(entry.errors, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40"
            >
              Newer
            </button>
            <span className="text-xs text-text-secondary">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <button
              onClick={() => void load(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || loading}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40"
            >
              Older
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
