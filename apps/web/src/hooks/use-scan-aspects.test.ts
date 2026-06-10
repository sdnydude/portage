import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useScanAspects } from "./use-scan-aspects";

const SUGGESTION = {
  categoryId: "33034",
  categoryName: "Electric Guitars",
  conditionIds: ["1000", "3000"],
};

const ASPECTS = {
  Brand: { required: true, values: ["Fender", "Gibson"] },
  Color: { required: false, values: ["Black", "Red"] },
};

function mockRoutes(
  suggestion: typeof SUGGESTION | null = SUGGESTION,
  aspects: Record<string, unknown> = ASPECTS,
) {
  apiMock.mockImplementation((path: string) => {
    if (path.startsWith("/marketplace/ebay/category-suggestion")) {
      return Promise.resolve({ suggestion });
    }
    if (path.startsWith("/marketplace/ebay/category-aspects/")) {
      return Promise.resolve({ aspects });
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  apiMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useScanAspects", () => {
  it("resolves the category after the 500ms debounce, not before", async () => {
    mockRoutes();
    const { result, rerender } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "", text: "" } },
    );

    rerender({ name: "Fender Stratocaster", text: "Fender Stratocaster" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(result.current.resolvedCategoryId).toBeNull();
    expect(apiMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.resolvedCategoryId).toBe("33034");
    expect(result.current.resolvedCategoryName).toBe("Electric Guitars");
    expect(result.current.conditionIds).toEqual(["1000", "3000"]);
    expect(result.current.isCategoryResolving).toBe(false);
  });

  it("discards stale resolutions when editName changes rapidly — latest wins", async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith("/marketplace/ebay/category-suggestion")) {
        return new Promise((res) => resolvers.push(res));
      }
      return Promise.resolve({ aspects: {} });
    });
    const { result, rerender } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "", text: "" } },
    );

    rerender({ name: "first", text: "" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    rerender({ name: "second", text: "" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(resolvers).toHaveLength(2);

    // Newest request settles first; the stale one settles afterwards.
    await act(async () => {
      resolvers[1]({
        suggestion: { categoryId: "B", categoryName: "Second", conditionIds: [] },
      });
      await Promise.resolve();
    });
    await act(async () => {
      resolvers[0]({
        suggestion: { categoryId: "A", categoryName: "First", conditionIds: [] },
      });
      await Promise.resolve();
    });

    expect(result.current.resolvedCategoryId).toBe("B");
    expect(result.current.resolvedCategoryName).toBe("Second");
  });

  it("loads the aspect schema and resets aspectValues when the category changes", async () => {
    let suggestion = SUGGESTION;
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith("/marketplace/ebay/category-suggestion")) {
        return Promise.resolve({ suggestion });
      }
      if (path.startsWith("/marketplace/ebay/category-aspects/")) {
        return Promise.resolve({ aspects: ASPECTS });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
    const { result, rerender } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "Fender Stratocaster", text: "" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.aspects).toEqual(ASPECTS);

    act(() => {
      result.current.setAspectValue("Brand", "Fender");
    });
    expect(result.current.aspectValues).toEqual({ Brand: "Fender" });

    suggestion = {
      categoryId: "619",
      categoryName: "Acoustic Guitars",
      conditionIds: ["3000"],
    };
    rerender({ name: "Martin acoustic", text: "" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.resolvedCategoryId).toBe("619");
    // Stale-aspect publish corruption guard: confirmed values from the old
    // category schema must not survive a category change.
    expect(result.current.aspectValues).toEqual({});
  });

  it("seeds suggestions from item text and confirmSuggestion moves them to aspectValues", async () => {
    mockRoutes();
    const { result } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      {
        initialProps: {
          name: "Fender Stratocaster",
          text: "Black Fender Stratocaster electric guitar",
        },
      },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.suggestions).toEqual({
      Brand: ["Fender"],
      Color: ["Black"],
    });

    act(() => {
      result.current.confirmSuggestion("Brand", "Fender");
    });
    expect(result.current.aspectValues).toEqual({ Brand: "Fender" });
    // Confirmed aspect names no longer appear in suggestions.
    expect(result.current.suggestions).toEqual({ Color: ["Black"] });
  });

  it("lists required aspect names with no confirmed value in missingRequired", async () => {
    mockRoutes(SUGGESTION, {
      Brand: { required: true, values: ["Fender"] },
      Model: { required: true, values: null },
      Color: { required: false, values: ["Black"] },
    });
    const { result } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "Fender Stratocaster", text: "" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.missingRequired).toEqual(["Brand", "Model"]);

    act(() => {
      result.current.setAspectValue("Brand", "Fender");
    });
    expect(result.current.missingRequired).toEqual(["Model"]);
  });

  it("aspectsBlockPublish stays true while resolving and until required aspects are confirmed", async () => {
    mockRoutes(SUGGESTION, { Brand: { required: true, values: ["Fender"] } });
    const { result } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "Fender Stratocaster", text: "" } },
    );

    // During the debounce + fetch window the publish button must stay disabled.
    expect(result.current.aspectsBlockPublish).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    // Resolution settled, but Brand is required and unconfirmed.
    expect(result.current.isCategoryResolving).toBe(false);
    expect(result.current.aspectsBlockPublish).toBe(true);

    act(() => {
      result.current.setAspectValue("Brand", "Fender");
    });
    expect(result.current.aspectsBlockPublish).toBe(false);
  });

  it("buildAspects returns trimmed single-element arrays and drops empties, with stable identity", async () => {
    mockRoutes();
    const { result } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "Fender Stratocaster", text: "" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const buildAspectsBefore = result.current.buildAspects;
    act(() => {
      result.current.setAspectValue("Brand", "  Fender ");
      result.current.setAspectValue("Color", "   ");
      result.current.setAspectValue("Model", "");
    });
    expect(result.current.buildAspects()).toEqual({ Brand: ["Fender"] });
    // Stable useCallback — same function identity across state updates.
    expect(result.current.buildAspects).toBe(buildAspectsBefore);
  });

  it("degrades gracefully on a null suggestion — nulls, empty conditionIds, no error state", async () => {
    mockRoutes(null);
    const { result } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "mystery widget", text: "" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.resolvedCategoryId).toBeNull();
    expect(result.current.resolvedCategoryName).toBeNull();
    expect(result.current.conditionIds).toEqual([]);
    expect(result.current.isCategoryResolving).toBe(false);
  });

  it("retains the previous resolution and confirmed values when a re-resolve fails", async () => {
    mockRoutes();
    const { result, rerender } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "Fender Stratocaster", text: "" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.resolvedCategoryId).toBe("33034");
    act(() => {
      result.current.setAspectValue("Brand", "Fender");
    });

    // Next resolution rejects (network blip); the aspects fetch keeps working.
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith("/marketplace/ebay/category-suggestion")) {
        return Promise.reject(new Error("network down"));
      }
      if (path.startsWith("/marketplace/ebay/category-aspects/")) {
        return Promise.resolve({ aspects: ASPECTS });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
    rerender({ name: "Fender Stratocaster Deluxe", text: "" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // A transient failure must not wipe the user's confirmed values — the
    // previous resolution is retained; only a confirmed `suggestion: null`
    // (no match) clears the resolved state.
    expect(result.current.isCategoryResolving).toBe(false);
    expect(result.current.resolvedCategoryId).toBe("33034");
    expect(result.current.aspectValues).toEqual({ Brand: "Fender" });
  });

  it("a failed initial resolution degrades to unresolved with the spinner stopped", async () => {
    apiMock.mockImplementation(() => Promise.reject(new Error("network down")));
    const { result } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "mystery widget", text: "" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    // isCategoryResolving must never stick true — that would leave
    // Save & List permanently disabled via aspectsBlockPublish.
    expect(result.current.isCategoryResolving).toBe(false);
    expect(result.current.resolvedCategoryId).toBeNull();
    expect(result.current.conditionIds).toEqual([]);
  });

  it("resolveCategory can be called manually to re-resolve (the 'change' affordance)", async () => {
    mockRoutes(null);
    const { result } = renderHook(
      ({ name, text }) => useScanAspects(name, text),
      { initialProps: { name: "mystery widget", text: "" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.resolvedCategoryId).toBeNull();

    mockRoutes(SUGGESTION);
    await act(async () => {
      await result.current.resolveCategory("Fender Stratocaster");
    });
    expect(result.current.resolvedCategoryId).toBe("33034");
    expect(result.current.resolvedCategoryName).toBe("Electric Guitars");
    expect(apiMock).toHaveBeenCalledWith(
      "/marketplace/ebay/category-suggestion?q=Fender%20Stratocaster",
      { token: "t" },
    );
  });
});
