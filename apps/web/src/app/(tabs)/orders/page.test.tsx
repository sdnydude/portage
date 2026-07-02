import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const useOrdersMock = vi.fn();
vi.mock("@/hooks/use-orders", () => ({ useOrders: () => useOrdersMock() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));

import OrdersPage from "./page";

describe("OrdersPage sync error", () => {
  it("renders the sync failure banner when syncError is set", () => {
    useOrdersMock.mockReturnValue({
      orders: [],
      isLoading: false,
      error: null,
      syncError: "eBay 401: invalid scope",
      isSyncing: false,
      syncOrders: vi.fn(),
    });

    render(<OrdersPage />);

    expect(screen.getByText(/Sync failed: eBay 401: invalid scope/)).toBeInTheDocument();
  });
});

describe("OrdersPage — Ship It", () => {
  it("links Ship-It to the eBay item page (new tab) for a pending eBay order", () => {
    useOrdersMock.mockReturnValue({
      orders: [{
        id: "o1", marketplace: "ebay", status: "payment_received", buyerUsername: "buyer1",
        salePrice: 10, soldAt: new Date().toISOString(), trackingNumber: null, ebayItemId: "306972688941",
      }],
      isLoading: false, error: null, syncError: null, isSyncing: false, syncOrders: vi.fn(),
    });

    render(<OrdersPage />);

    const link = screen.getByRole("link", { name: "Ship It" });
    expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/306972688941");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("OrdersPage — sold-list rows", () => {
  it("renders the item thumbnail and title on each order row", () => {
    useOrdersMock.mockReturnValue({
      orders: [{
        id: "o1", marketplace: "ebay", status: "payment_received", buyerUsername: "buyer1",
        salePrice: 10, soldAt: new Date().toISOString(), trackingNumber: null, ebayItemId: "306972688941",
        itemTitle: "Mic Kit", itemPhotos: [{ url: "https://x/p.jpg", isPrimary: true }],
      }],
      isLoading: false, error: null, syncError: null, isSyncing: false, syncOrders: vi.fn(),
    });

    render(<OrdersPage />);

    expect(screen.getByText("Mic Kit")).toBeInTheDocument();
    const thumb = screen.getByRole("img", { name: "Mic Kit" });
    expect(thumb).toHaveAttribute("src", "https://x/p.jpg");
  });
});
