import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: h.apiMock, ApiError: class extends Error {} }));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useUserPreferences } from "./use-user-preferences";

beforeEach(() => h.apiMock.mockReset());

describe("useUserPreferences — disclaimerSuppressed (F3b)", () => {
  it("exposes disclaimerSuppressed from the preferences response", async () => {
    h.apiMock.mockResolvedValue({
      listingInterface: "hybrid", listingForkPref: "ask", listingForkCount: 0, listingCompactMode: false,
      disclaimerSuppressed: true,
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => expect(result.current.disclaimerSuppressed).toBe(true));
  });
});
