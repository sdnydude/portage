import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args), ApiError: class extends Error {} }));

import OrderDetailPage from "./page";

beforeEach(() => apiMock.mockReset());

const baseOrder = {
  id: "o1", listingId: "l1", itemId: "i1", marketplace: "ebay",
  marketplaceOrderId: "14-1", buyerUsername: "buyer1",
  salePrice: 10, shippingCost: 1, marketplaceFees: 1, currency: "USD",
  status: "payment_received", trackingNumber: null, carrier: null, shippingLabelUrl: null,
  soldAt: new Date().toISOString(), shippedAt: null, deliveredAt: null,
  item: { id: "i1", title: "Mic", photos: [], category: "" },
  ebayItemId: "306972688941",
};

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <OrderDetailPage params={Promise.resolve({ id: "o1" })} />
      </Suspense>,
    );
  });
  // Flush the use(params) suspense + the async fetchOrder effect.
  await act(async () => { await Promise.resolve(); });
}

describe("OrderDetailPage — Ship It", () => {
  it("opens the eBay item page (new tab) for a pending eBay order", async () => {
    apiMock.mockResolvedValue(baseOrder);

    await renderPage();

    const link = await screen.findByRole("link", { name: "Ship It" });
    expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/306972688941");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("OrderDetailPage — Mark as Shipped", () => {
  it("PATCHes the order to shipped after shipping on eBay (no carrier subsystem)", async () => {
    apiMock.mockResolvedValue(baseOrder);

    await renderPage();

    const btn = await screen.findByRole("button", { name: /mark as shipped/i });
    await act(async () => { fireEvent.click(btn); });

    expect(apiMock).toHaveBeenCalledWith(
      "/orders/o1",
      expect.objectContaining({ method: "PATCH", body: { status: "shipped" }, token: "t" }),
    );
  });
});

describe("OrderDetailPage — Financials", () => {
  it("hides fees and profit when fees are unknown (0) — no bogus negative profit", async () => {
    apiMock.mockResolvedValue({ ...baseOrder, marketplaceFees: 0 });

    await renderPage();

    expect(await screen.findByText("Sale Price")).toBeInTheDocument();
    expect(screen.getByText("Shipping Cost")).toBeInTheDocument();
    expect(screen.queryByText("Marketplace Fees")).not.toBeInTheDocument();
    expect(screen.queryByText("Profit")).not.toBeInTheDocument();
  });
});

describe("OrderDetailPage — canceled order", () => {
  it("shows a Canceled notice instead of an ambiguous all-incomplete shipping timeline", async () => {
    apiMock.mockResolvedValue({ ...baseOrder, status: "canceled" });
    await renderPage();

    // A canceled+refunded order must say so — not render four unchecked
    // shipping steps as if it's simply waiting to ship.
    expect(screen.getByText("Order canceled.")).toBeInTheDocument();
    expect(screen.queryByText("Shipping Status")).toBeNull();
  });
});
