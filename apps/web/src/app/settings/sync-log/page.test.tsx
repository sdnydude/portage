import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: (...args: unknown[]) => apiMock(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));

import SyncLogPage from "./page";

beforeEach(() => {
  apiMock.mockReset();
});

describe("SyncLogPage", () => {
  it("lists sync attempts with status, marketplace, and failure message", async () => {
    apiMock.mockResolvedValue({
      entries: [
        {
          id: "log-1", listingId: "l1", itemId: "i1", marketplace: "reverb",
          trigger: "item_edit", status: "failure",
          message: "Reverb 422: shipping required",
          errors: [{ field: "shipping" }], durationMs: 812,
          createdAt: "2026-08-03T09:00:00Z",
        },
        {
          id: "log-2", listingId: "l2", itemId: "i2", marketplace: "ebay",
          trigger: "publish", status: "success",
          message: null, errors: null, durationMs: 1204,
          createdAt: "2026-08-03T08:00:00Z",
        },
      ],
      total: 2, limit: 25, offset: 0,
    });

    render(<SyncLogPage />);

    expect(await screen.findByText(/Reverb 422: shipping required/)).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/success/i).length).toBeGreaterThan(0);
    expect(apiMock).toHaveBeenCalledWith(expect.stringContaining("/sync-log?"), expect.objectContaining({ token: "t" }));
  });
});
