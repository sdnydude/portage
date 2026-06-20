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

describe("useListingFlow.publish — draft-fallback warning", () => {
  it("returns and stores the API warning when publish falls back to draft", async () => {
    apiMock.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path === "/items/i1" && opts?.method === "PATCH") return {};
      if (path === "/items/i1") {
        return {
          id: "i1", title: "Mic Kit", description: "d", category: "electronics", condition: "new",
          brand: "", model: "", features: [], quantity: 1,
          photos: [{ url: "https://example.com/p.jpg", key: "k1" }],
          estimatedValueRecommended: 50, price: 65,
          weightOz: 24, lengthIn: null, widthIn: null, heightIn: null,
          ebayPackageType: null, weightEstimated: false,
        };
      }
      if (path === "/listings") {
        return { id: "L1", status: "draft", warning: "Listing created as draft — publish to eBay failed: account locked" };
      }
      // prepare-listing / seller-profile lookups are non-fatal in publish()
      throw new Error("unavailable: " + path);
    });

    const { result } = renderHook(() => useListingFlow());
    await act(async () => {
      await result.current.startFromItem("i1");
    });
    let res: { success: boolean; warning?: string } = { success: false };
    await act(async () => {
      res = await result.current.publish();
    });

    expect(res.success).toBe(true);
    expect(res.warning).toContain("account locked");
    expect(result.current.state.publishWarning).toContain("account locked");
  });

  it("carries aspect-sheet aspects into the publish even when prepare-listing yields nothing (no silent drop)", async () => {
    let listingsBody: { marketplaceSpecificFields?: { aspects?: Record<string, string[]> } } | undefined;
    apiMock.mockImplementation(async (path: string, opts?: { method?: string; body?: unknown }) => {
      if (path === "/items/i1" && opts?.method === "PATCH") return {};
      if (path === "/items/i1") {
        return {
          id: "i1", title: "Mic Kit", description: "d", category: "electronics", condition: "new",
          brand: "", model: "", features: [], quantity: 1,
          photos: [{ url: "https://example.com/p.jpg", key: "k1" }],
          estimatedValueRecommended: 50, price: 65,
          weightOz: 24, lengthIn: null, widthIn: null, heightIn: null,
          ebayPackageType: null, weightEstimated: false,
        };
      }
      // prepare-listing yields nothing (failure / photo-first path)
      if (path === "/items/i1/prepare-listing") throw new Error("prepare unavailable");
      if (path === "/listings") {
        listingsBody = opts?.body as typeof listingsBody;
        return { id: "L1", status: "active" };
      }
      throw new Error("unavailable: " + path);
    });

    const { result } = renderHook(() => useListingFlow());
    await act(async () => {
      await result.current.startFromItem("i1");
    });
    await act(async () => {
      // Retry after EBAY_ASPECTS_REQUIRED: the seller's confirmed aspects must
      // survive to the publish body, not be dropped because prepare() failed.
      await result.current.publish({ aspects: { Brand: ["Shure"], Type: ["Dynamic"] } });
    });

    expect(listingsBody?.marketplaceSpecificFields?.aspects).toEqual({
      Brand: ["Shure"],
      Type: ["Dynamic"],
    });
  });
});
