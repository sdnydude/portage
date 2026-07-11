import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useListings } from "./use-listings";

beforeEach(() => apiMock.mockReset());

describe("useListings itemId filter", () => {
  it("passes itemId as a query param", async () => {
    apiMock.mockResolvedValue({ listings: [], total: 0, limit: 50, offset: 0 });

    const { result } = renderHook(() => useListings({ itemId: "abc" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock).toHaveBeenCalledWith(
      expect.stringContaining("itemId=abc"),
      expect.anything(),
    );
  });
});
