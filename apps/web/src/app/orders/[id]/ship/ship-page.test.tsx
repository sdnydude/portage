import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
}));
vi.mock("@/lib/api", () => ({
  api: vi.fn(async (path: string) => {
    if (path.startsWith("/orders/")) {
      return {
        id: "o1",
        status: "payment_received",
        marketplace: "ebay",
        marketplaceOrderId: "22-1",
        salePrice: 65,
        shippingCost: 0,
        currency: "USD",
        trackingNumber: null,
        carrier: null,
        shippingLabelUrl: null,
        shippedAt: null,
        buyerUsername: "buyer1",
        soldAt: new Date().toISOString(),
        item: { id: "i1", title: "Mic Kit", photos: [] },
      };
    }
    return {};
  }),
  ApiError: class extends Error {},
}));

const purchaseLabelMock = vi.fn(async () => ({
  orderId: "o1",
  trackingNumber: "STUBABC123",
  carrier: "USPS",
  shippingLabelUrl: null,
  status: "payment_received",
  isStub: true,
  message: "Shipping provider not configured. Connect a provider in Settings > Shipping to purchase real labels.",
}));

vi.mock("@/hooks/use-shipping", () => ({
  useShippingPresets: () => ({ presets: [], isLoading: false, error: null, savePreset: vi.fn(), deletePreset: vi.fn() }),
  useShippingRates: () => ({
    rates: [{ rateId: "r1", carrier: "USPS", service: "Priority Mail", price: 8.5, currency: "USD", estimatedDays: 2, source: "marketplace" }],
    isLoading: false,
    error: null,
    fetchRates: vi.fn(),
  }),
  useShippingLabel: () => ({ purchaseLabel: purchaseLabelMock, isLoading: false, error: null }),
}));

import ShipPage from "./page";

describe("ShipPage — stubbed label purchase", () => {
  it("surfaces the provider-not-configured message prominently instead of a fake success", async () => {
    // React's use() reads an already-fulfilled thenable synchronously — a real
    // Promise leaves the page suspended forever under jsdom.
    const params = { status: "fulfilled", value: { id: "o1" }, then() {} } as unknown as Promise<{ id: string }>;
    render(<ShipPage params={params} />);

    // select the rate, then buy
    fireEvent.click(await screen.findByText("Priority Mail"));
    fireEvent.click(await screen.findByRole("button", { name: /Buy Label/ }));

    await waitFor(() => expect(purchaseLabelMock).toHaveBeenCalledTimes(1));

    // the stub message is a visible alert with a path to fix it…
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Shipping provider not configured/);
    expect(screen.getByRole("link", { name: /set up shipping/i })).toHaveAttribute("href", "/settings/shipping");
    // …and the fake success state is gone
    expect(screen.queryByText("Label Purchased")).not.toBeInTheDocument();
    expect(screen.queryByText("STUBABC123")).not.toBeInTheDocument();
  });
});
