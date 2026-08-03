import { describe, it, expect } from "vitest";
import { toStatusMap, shouldContinuePolling } from "./sync-status";

describe("sync-status helpers", () => {
  it("maps the API list to a listingId-keyed record and keeps polling only while something is pending", () => {
    const map = toStatusMap([
      { listingId: "l1", state: "pending", lastAttemptAt: "2026-08-03T09:00:00Z" },
      { listingId: "l2", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z", message: "Reverb 422" },
    ]);
    expect(map.l1.state).toBe("pending");
    expect(map.l2.message).toBe("Reverb 422");
    expect(shouldContinuePolling(map)).toBe(true);
    expect(shouldContinuePolling(toStatusMap([
      { listingId: "l2", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z" },
      { listingId: "l3", state: "synced", lastAttemptAt: "2026-08-03T09:00:00Z" },
    ]))).toBe(false);
  });
});
