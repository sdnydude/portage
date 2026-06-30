import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useResearch } from "./use-research";

beforeEach(() => apiMock.mockReset());

describe("useResearch", () => {
  it("fetches /items/:id/research and exposes the result", async () => {
    const payload = {
      category: { categoryId: "175669", categoryName: "SSD" },
      aspects: { filled: [], missing: [] },
      demand: null,
      traffic: null,
    };
    apiMock.mockResolvedValue(payload);

    const { result } = renderHook(() => useResearch("item-9"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiMock).toHaveBeenCalledWith("/items/item-9/research", { token: "t" });
    expect(result.current.research).toEqual(payload);
    expect(result.current.error).toBeNull();
  });
});
