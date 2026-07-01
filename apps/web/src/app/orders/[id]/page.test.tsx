import { Suspense } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@/hooks/use-shipping", () => ({ useShippingLabel: () => ({ markShipped: vi.fn() }) }));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args), ApiError: class extends Error {} }));

import OrderDetailPage from "./page";

describe("OrderDetailPage — Ship It", () => {
  it("opens the eBay item page (new tab) for a pending eBay order", async () => {
    apiMock.mockResolvedValue({
      id: "o1", listingId: "l1", itemId: "i1", marketplace: "ebay",
      marketplaceOrderId: "14-1", buyerUsername: "buyer1",
      salePrice: 10, shippingCost: 1, marketplaceFees: 1, currency: "USD",
      status: "payment_received", trackingNumber: null, carrier: null, shippingLabelUrl: null,
      soldAt: new Date().toISOString(), shippedAt: null, deliveredAt: null,
      item: { id: "i1", title: "Mic", photos: [], category: "" },
      ebayItemId: "306972688941",
    });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <OrderDetailPage params={Promise.resolve({ id: "o1" })} />
        </Suspense>,
      );
    });
    // Flush the use(params) suspense + the async fetchOrder effect.
    await act(async () => { await Promise.resolve(); });

    const link = await screen.findByRole("link", { name: "Ship It" });
    expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/306972688941");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
