import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));

import BillingPage from "./page";

describe("BillingPage — light-mode tag contrast (operator: tags unreadable in light mode, 2026-09-06)", () => {
  it("renders a near-limit usage count on the legible amber-700 shade", async () => {
    apiMock.mockResolvedValue({
      effectiveTier: "free",
      trial: null,
      subscription: null,
      usage: {
        aiListings: { used: 9, limit: 10, credits: 0 },
        bgRemovals: { used: 0, limit: 5 },
        porterExchanges: { limit: 5 },
        marketplaces: { limit: 1 },
      },
    });

    await act(async () => render(<BillingPage />));

    expect(screen.getByText("9 / 10")).toHaveClass("text-amber-700");
  });
});
