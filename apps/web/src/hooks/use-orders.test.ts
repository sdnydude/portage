import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useOrders } from "./use-orders";

beforeEach(() => apiMock.mockReset());

describe("useOrders sync", () => {
  it("sets syncError when /orders/sync reports a marketplace failure", async () => {
    // initial fetch
    apiMock.mockResolvedValueOnce({ orders: [] });
    const { result } = renderHook(() => useOrders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // sync returns a per-marketplace error, then the refetch
    apiMock.mockResolvedValueOnce({
      synced: 0,
      newOrders: [],
      errors: [{ marketplace: "ebay", message: "eBay 401: invalid scope" }],
    });
    apiMock.mockResolvedValueOnce({ orders: [] });

    await act(async () => {
      await result.current.syncOrders();
    });

    expect(result.current.syncError).toBe("eBay 401: invalid scope");
  });

  it("exposes isSyncing true while the sync request is in flight", async () => {
    apiMock.mockResolvedValueOnce({ orders: [] });
    const { result } = renderHook(() => useOrders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveSync: (v: unknown) => void = () => {};
    apiMock.mockReturnValueOnce(new Promise((r) => { resolveSync = r; }));
    apiMock.mockResolvedValueOnce({ orders: [] });

    let syncPromise: Promise<void>;
    act(() => {
      syncPromise = result.current.syncOrders();
    });

    await waitFor(() => expect(result.current.isSyncing).toBe(true));

    await act(async () => {
      resolveSync({ synced: 0, newOrders: [], errors: [] });
      await syncPromise;
    });

    expect(result.current.isSyncing).toBe(false);
  });
});
