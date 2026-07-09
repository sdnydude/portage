import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ListingsPage from "./page";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
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
    expect(screen.getByText("Sony WH-1000XM4")).toBeInTheDocument();
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
    expect(screen.getByText("Untitled item")).toBeInTheDocument();
  });
});
