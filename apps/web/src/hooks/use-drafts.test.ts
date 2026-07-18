import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useDrafts } from "./use-drafts";
import type { ListingFlowState } from "@portage/shared";

const flowState = { photos: [] } as unknown as ListingFlowState;

beforeEach(() => {
  vi.useFakeTimers();
  apiMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useDrafts.saveDraft — stale retry guard", () => {
  it("a failed save's retry aborts once a newer save has been issued (no stale overwrite)", async () => {
    const { result } = renderHook(() => useDrafts());

    // Save A: first attempt rejects → 2s backoff retry scheduled.
    apiMock.mockRejectedValueOnce(new Error("network"));
    let resolveA!: (v: unknown) => void;
    const pendingA = new Promise((r) => { resolveA = r; });
    let saveA!: Promise<unknown>;
    act(() => {
      saveA = result.current.saveDraft(flowState, { marketplace: "ebay" });
    });
    // Let the rejection land; A now waits on its backoff timer.
    await act(async () => { await Promise.resolve(); });

    // Save B supersedes A and succeeds immediately.
    apiMock.mockResolvedValueOnce({ id: "d2" });
    await act(async () => {
      await result.current.saveDraft(flowState, { marketplace: "ebay" });
    });
    const callsAfterB = apiMock.mock.calls.length;

    // A's retry timer fires — it must NOT POST the stale snapshot.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await saveA;
    });
    expect(apiMock.mock.calls.length).toBe(callsAfterB);
    void pendingA; void resolveA;
  });
});
