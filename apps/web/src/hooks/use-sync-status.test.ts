import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSyncStatus } from "./use-sync-status";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSyncStatus", () => {
  it("fetches statuses for the listing ids on mount and exposes them keyed by listingId", async () => {
    vi.mocked(api).mockResolvedValueOnce({
      statuses: [{ listingId: "l1", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z", message: "Reverb 422" }],
    });

    const { result } = renderHook(() => useSyncStatus(["l1"], "tok"));

    await waitFor(() => {
      expect(result.current.syncStatuses.l1?.state).toBe("failed");
    });
    expect(api).toHaveBeenCalledWith("/sync-log/status?listingIds=l1", { token: "tok" });
  });

  it("a stale in-flight poll response does not overwrite the optimistic retry state (audit M4)", async () => {
    vi.mocked(api).mockResolvedValueOnce({
      statuses: [{ listingId: "l1", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z", message: "Reverb 422" }],
    });
    const { result } = renderHook(() => useSyncStatus(["l1"], "tok"));
    await waitFor(() => expect(result.current.syncStatuses.l1?.state).toBe("failed"));

    // T0: a poll goes out on a slow network and hangs.
    let resolveStale!: (v: unknown) => void;
    vi.mocked(api).mockReturnValueOnce(new Promise((r) => { resolveStale = r; }) as never);
    const stalePoll = result.current.refreshSyncStatuses();

    // T1: user clicks Retry — optimistic pending.
    vi.mocked(api).mockResolvedValueOnce({ queued: true, listingId: "l1" });
    await result.current.retrySync("l1");
    await waitFor(() => expect(result.current.syncStatuses.l1?.state).toBe("pending"));

    // T3: the T0 response lands with PRE-retry state — it must be discarded.
    await act(async () => {
      resolveStale({
        statuses: [{ listingId: "l1", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z", message: "Reverb 422" }],
      });
      await stalePoll;
    });

    expect(result.current.syncStatuses.l1?.state).toBe("pending");
  });

  it("retrySync POSTs the retry and optimistically flips the badge back to pending", async () => {
    vi.mocked(api).mockResolvedValueOnce({
      statuses: [{ listingId: "l1", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z", message: "Reverb 422" }],
    });
    const { result } = renderHook(() => useSyncStatus(["l1"], "tok"));
    await waitFor(() => expect(result.current.syncStatuses.l1?.state).toBe("failed"));

    vi.mocked(api).mockResolvedValueOnce({ queued: true, listingId: "l1" });
    await result.current.retrySync("l1");

    expect(api).toHaveBeenCalledWith("/sync-log/retry", { method: "POST", body: { listingId: "l1" }, token: "tok" });
    await waitFor(() => expect(result.current.syncStatuses.l1?.state).toBe("pending"));
  });
});
