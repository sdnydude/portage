import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const apiMock = vi.fn();
const debouncedSaveMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("./use-drafts", () => ({
  useDrafts: () => ({
    drafts: [], isLoading: false, error: null, fetchDrafts: vi.fn(),
    getDraft: vi.fn(), saveDraft: vi.fn(), debouncedSave: debouncedSaveMock, deleteDraft: vi.fn(),
  }),
}));

import { useListingFlow } from "./use-listing-flow";

describe("useListingFlow.startFromItem — price seed", () => {
  it("seeds the flow price from the item's set price, not just the AI estimate", async () => {
    apiMock.mockResolvedValue({
      id: "i1", title: "X", description: "", category: "", condition: "good",
      brand: "", model: "", features: [], quantity: 1, photos: [],
      estimatedValueRecommended: 50, price: 175,
      weightOz: null, lengthIn: null, widthIn: null, heightIn: null,
      ebayPackageType: null, weightEstimated: false,
    });
    const { result } = renderHook(() => useListingFlow());
    await act(async () => {
      await result.current.startFromItem("i1");
    });
    expect(result.current.state.price).toBe(175);
  });
});

describe("useListingFlow.updatePhoto", () => {
  it("replaces a single photo's fields in place (photo-edit tools persist through this)", () => {
    const { result } = renderHook(() => useListingFlow());
    act(() => {
      result.current.addPhotos([
        { url: "https://example.com/1.jpg", key: "k1" },
        { url: "https://example.com/2.jpg", key: "k2" },
      ]);
    });
    act(() => {
      result.current.updatePhoto(1, { url: "https://example.com/2-rot.jpg", key: "k2-rot", width: 800, height: 600 });
    });
    expect(result.current.state.photos).toEqual([
      { url: "https://example.com/1.jpg", key: "k1" },
      { url: "https://example.com/2-rot.jpg", key: "k2-rot", width: 800, height: 600 },
    ]);
  });

  it("throws on a vanished index (photo deleted mid-edit) so tool errors surface instead of leaking the R2 write", () => {
    const { result } = renderHook(() => useListingFlow());
    act(() => {
      result.current.addPhotos([{ url: "https://example.com/1.jpg", key: "k1" }]);
    });
    expect(() =>
      act(() => result.current.updatePhoto(5, { url: "https://example.com/x.jpg" })),
    ).toThrow(/no longer exists/);
    expect(result.current.state.photos).toEqual([{ url: "https://example.com/1.jpg", key: "k1" }]);
  });

  it("triggers the draft autosave so edits survive a browser close", () => {
    const { result } = renderHook(() => useListingFlow());
    act(() => {
      result.current.addPhotos([{ url: "https://example.com/1.jpg", key: "k1" }]);
    });
    debouncedSaveMock.mockClear();
    act(() => result.current.updatePhoto(0, { url: "https://example.com/1-rot.jpg" }));
    expect(debouncedSaveMock).toHaveBeenCalled();
  });
});
