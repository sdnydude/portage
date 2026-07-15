import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import OrdersPage from "./page";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
}));
vi.mock("@/hooks/use-messages", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/orders",
  useRouter: () => ({ push: vi.fn() }),
}));
const ordersMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-orders", () => ({ useOrders: ordersMock }));

beforeEach(() => {
  vi.clearAllMocks();
  ordersMock.mockReturnValue({
    orders: [{
      id: "o1", marketplace: "ebay", marketplaceOrderId: "26-14725-05164",
      status: "canceled", salePrice: 306.23, currency: "USD",
      soldAt: "2026-06-10T00:00:00Z", itemTitle: "Samsung 990 PRO 2TB", itemPhotos: [],
      buyerUsername: "b", shippingCost: 0, marketplaceFees: 0,
    }],
    isLoading: false, error: null, syncOrders: vi.fn(), isSyncing: false, syncError: null,
  });
});

describe("OrdersPage — canceled orders", () => {
  it("shows a Canceled chip and keeps the order OUT of Needs Shipping", () => {
    render(<OrdersPage />);
    // The live bug: a canceled+refunded eBay order sat in the ship queue.
    expect(screen.getByText("Canceled")).toBeInTheDocument();
    expect(screen.queryByText(/NEEDS SHIPPING/i)).toBeNull();
    expect(screen.queryByText("Ship It")).toBeNull();
  });
});
