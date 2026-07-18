import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useRequiredAspects } from "./use-required-aspects";

describe("useRequiredAspects", () => {
  it("excludes physical weight/dimension aspect names — dedicated fields own those", async () => {
    // eBay category 177 (PC Laptops) really publishes Item Weight/Height/
    // Length/Width as optional aspects (live-verified 2026-07-10). Rendering
    // them as generic aspect inputs duplicated the dedicated AI-filled
    // weight & dims fields at the top of the item setup page — empty twins.
    apiMock.mockResolvedValue({
      aspects: {
        "Brand": { required: true, values: ["ASUS"] },
        "Screen Size": { required: false, values: null },
        "Item Weight": { required: false, values: null },
        "Item Height": { required: false, values: null },
        "Item Length": { required: false, values: null },
        "Item Width": { required: false, values: null },
        "Item Depth": { required: false, values: null },
      },
    });

    const { result } = renderHook(() => useRequiredAspects("177"));
    await waitFor(() => expect(Object.keys(result.current.aspects).length).toBeGreaterThan(0));

    expect(Object.keys(result.current.aspects).sort()).toEqual(["Brand", "Screen Size"]);
  });
});
