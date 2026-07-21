import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

import { useReverbCategories } from "./use-reverb-categories";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useReverbCategories", () => {
  it("loads the flat category list from the API", async () => {
    apiMock.mockResolvedValueOnce({
      categories: [{ uuid: "u1", fullName: "Effects and Pedals / Distortion" }],
    });

    const { result } = renderHook(() => useReverbCategories());

    await waitFor(() => {
      expect(result.current.categories).toEqual([
        { uuid: "u1", fullName: "Effects and Pedals / Distortion" },
      ]);
    });
    expect(apiMock).toHaveBeenCalledWith("/marketplace/reverb/categories", { token: "test-token" });
  });
});
