import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ListingsPage from "./page";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
}));
vi.mock("@/hooks/use-messages", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/listings",
  useRouter: () => ({ push: vi.fn() }),
}));
const listingsMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-listings", () => ({
  useListings: listingsMock,
}));
vi.mock("@/lib/api", () => ({ api: vi.fn(), ApiError: class extends Error {} }));

beforeEach(() => {
  vi.clearAllMocks();
  listingsMock.mockReturnValue({
    listings: [{
      id: "L1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: "3001", marketplaceSpecificFields: null,
      status: "active", price: 199, currency: "USD",
      createdAt: "2026-07-01T00:00:00Z", publishedAt: "2026-07-01T00:00:00Z", soldAt: null,
      itemTitle: "Sony WH-1000XM4",
    }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe("ListingsPage — item title on each row", () => {
  it("shows WHAT the listing is, not just price/status", () => {
    render(<ListingsPage />);
    // Scoped to the mobile row (a <Link>) — the R1 desktop workbench renders
    // the same title again in its own pane (lg:hidden / lg:flex are CSS-only,
    // both trees are always in the DOM), so an unscoped query now matches twice.
    expect(within(screen.getByRole("link")).getByText("Sony WH-1000XM4")).toBeInTheDocument();
  });

  it("row links to the item hub deep link (listing-hub Task 4)", () => {
    render(<ListingsPage />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/inventory/i1?listing=L1");
  });

  it("falls back to 'Untitled item' when the joined title is missing", () => {
    listingsMock.mockReturnValue({
      listings: [{
        id: "L2", itemId: "i2", userId: "u1", marketplace: "reverb",
        marketplaceListingId: null, marketplaceSpecificFields: null,
        status: "draft", price: 50, currency: "USD",
        createdAt: "2026-07-01T00:00:00Z", publishedAt: null, soldAt: null,
        itemTitle: null,
      }],
      isLoading: false, error: null, refetch: vi.fn(),
    });
    render(<ListingsPage />);
    // Scoped to the mobile row for the same reason as the test above.
    expect(within(screen.getByRole("link")).getByText("Untitled item")).toBeInTheDocument();
  });
});
