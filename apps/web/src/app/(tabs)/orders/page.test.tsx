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
