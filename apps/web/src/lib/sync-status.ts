// P3 sync truth surface — shared shapes + pure helpers for the badge hook.

export type SyncBadgeState = "pending" | "failed" | "synced";

export interface ListingSyncStatus {
  listingId: string;
  state: SyncBadgeState;
  lastAttemptAt: string;
  message?: string;
}

export function toStatusMap(list: ListingSyncStatus[]): Record<string, ListingSyncStatus> {
  const map: Record<string, ListingSyncStatus> = {};
  for (const s of list) map[s.listingId] = s;
  return map;
}

/** Poll while any listing is still pending — stop once everything settled. */
export function shouldContinuePolling(map: Record<string, ListingSyncStatus>): boolean {
  return Object.values(map).some((s) => s.state === "pending");
}
