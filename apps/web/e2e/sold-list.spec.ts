import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// Verifies the simplified sold-orders panel end-to-end against the rebuilt
// :3002 container. GET /orders is mocked at the network boundary (same
// pattern as orders-sync.spec.ts) so row assertions are deterministic and
// independent of which account/orders exist in the environment.

const ORDERS_PAYLOAD = {
  orders: [
    {
      id: "e2e-o1", listingId: "l1", itemId: "i1", userId: "u1",
      marketplace: "ebay", marketplaceOrderId: "14-11111-22222",
      buyerUsername: "e2e_buyer", salePrice: 42.5, shippingCost: 5.2,
      marketplaceFees: 0, currency: "USD", status: "payment_received",
      trackingNumber: null, carrier: null, shippingLabelUrl: null,
      soldAt: "2026-06-28T15:00:00.000Z", shippedAt: null, deliveredAt: null,
      ebayItemId: "306972688941",
      itemTitle: "Vintage Sanders Tape Measure",
      itemPhotos: [{ url: "https://picsum.photos/seed/portage-e2e/96", isPrimary: true }],
    },
    {
      id: "e2e-o2", listingId: "l2", itemId: "i2", userId: "u1",
      marketplace: "ebay", marketplaceOrderId: "14-33333-44444",
      buyerUsername: "e2e_buyer2", salePrice: 19, shippingCost: 4,
      marketplaceFees: 0, currency: "USD", status: "shipped",
      trackingNumber: "9400111899560000000000", carrier: "USPS",
      shippingLabelUrl: null,
      soldAt: "2026-06-20T12:00:00.000Z", shippedAt: "2026-06-21T12:00:00.000Z", deliveredAt: null,
      ebayItemId: "306972688942",
      itemTitle: "Apple TV Siri Remote",
      itemPhotos: [{ url: "https://picsum.photos/seed/portage-e2e2/96", isPrimary: true }],
    },
  ],
  pagination: { limit: 50, offset: 0 },
};

async function mockOrdersList(page: import("@playwright/test").Page) {
  await page.route(/\/orders(\?[^/]*)?$/, async (route) => {
    const req = route.request();
    // Only intercept the API list fetch — NOT the page navigation to /orders
    // (same path!) and not POST /orders/sync.
    if (req.method() !== "GET" || req.resourceType() !== "fetch") { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ORDERS_PAYLOAD),
    });
  });
}

async function assertSoldRows(page: import("@playwright/test").Page) {
  // Title + thumbnail + price + relative date on the pending row.
  await expect(page.getByText("Vintage Sanders Tape Measure")).toBeVisible();
  await expect(page.getByRole("img", { name: "Vintage Sanders Tape Measure" })).toBeVisible();
  await expect(page.getByText("$42.50")).toBeVisible();
  // Ship-It taps through to the eBay item page in a new tab.
  const shipIt = page.getByRole("link", { name: "Ship It" });
  await expect(shipIt).toHaveAttribute("href", "https://www.ebay.com/itm/306972688941");
  await expect(shipIt).toHaveAttribute("target", "_blank");
  // Shipped row renders in the All Orders section with its status chip.
  await expect(page.getByText("Apple TV Siri Remote")).toBeVisible();
  await expect(page.getByText("Shipped", { exact: true })).toBeVisible();
  await expect(page.getByText("$19.00")).toBeVisible();
}

test.describe("sold-orders panel", () => {
  test("renders thumbnail/title/date/price rows and survives reload", async ({ page }) => {
    await mockOrdersList(page);

    await page.goto("/orders");
    await assertSoldRows(page);
    await page.screenshot({ path: path.join(SHOT_DIR, "sold-list-rows.png"), fullPage: true });

    // Reload and re-assert — proves the wiring, not transient local state.
    await page.reload();
    await assertSoldRows(page);
    await page.screenshot({ path: path.join(SHOT_DIR, "sold-list-rows-after-reload.png"), fullPage: true });
  });

  test("carrier subsystem is gone: no shipping settings link, ship page 404s", async ({ page }) => {
    await page.goto("/more");
    await expect(page.getByText("Notifications")).toBeVisible();
    await expect(page.locator('a[href="/settings/shipping"]')).toHaveCount(0);

    const res = await page.goto("/orders/e2e-o1/ship");
    expect(res?.status()).toBe(404);
    await page.screenshot({ path: path.join(SHOT_DIR, "ship-page-404.png"), fullPage: true });
  });
});
