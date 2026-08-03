"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toStatusMap, shouldContinuePolling, type ListingSyncStatus } from "@/lib/sync-status";

const POLL_MS = 4000;

/**
 * Per-listing sync badge state (P3 truth surface). Fetches once on mount and
 * keeps polling every 4s while any listing is still pending, so the badge
 * flips pending → synced/failed without a manual refresh.
 */
export function useSyncStatus(listingIds: string[], token: string | null) {
  const [statuses, setStatuses] = useState<Record<string, ListingSyncStatus>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Poll re-entry goes through a ref so the callback doesn't reference itself
  // (self-reference inside useCallback is a TDZ lint error).
  const fetchRef = useRef<() => Promise<void>>(async () => {});
  const idsKey = listingIds.filter(Boolean).sort().join(",");

  const fetchStatuses = useCallback(async () => {
    if (!idsKey || !token) return;
    try {
      const res = await api<{ statuses: ListingSyncStatus[] }>(`/sync-log/status?listingIds=${idsKey}`, { token });
      const map = toStatusMap(res.statuses);
      setStatuses(map);
      if (shouldContinuePolling(map)) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { void fetchRef.current(); }, POLL_MS);
      }
    } catch {
      // Badge data is auxiliary — a failed status fetch must never break the page.
    }
  }, [idsKey, token]);

  useEffect(() => {
    fetchRef.current = fetchStatuses;
  }, [fetchStatuses]);

  useEffect(() => {
    void fetchStatuses();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchStatuses]);

  // Re-enqueue a full push and flip the badge back to pending optimistically;
  // the poll timer then confirms the real outcome.
  const retrySync = useCallback(async (listingId: string) => {
    if (!token) return;
    await api("/sync-log/retry", { method: "POST", body: { listingId }, token });
    setStatuses((prev) => ({
      ...prev,
      [listingId]: { listingId, state: "pending", lastAttemptAt: new Date().toISOString() },
    }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void fetchStatuses(); }, POLL_MS);
  }, [token, fetchStatuses]);

  return { syncStatuses: statuses, retrySync, refreshSyncStatuses: fetchStatuses };
}
