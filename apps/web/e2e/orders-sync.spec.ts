import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// Verifies the orders-sync wiring end-to-end against the rebuilt :3002 container.
// /orders/sync is mocked at the network boundary so the assertion is
// deterministic and independent of whether the live eBay account has orders.


test.describe("orders sync", () => {
  test("Sync button surfaces a marketplace error as a banner", async ({ page }) => {
    // Session injected via storageState (auth.setup.ts) — already logged in.
    await page.route("**/orders/sync", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          synced: 0,
          newOrders: [],
          errors: [{ marketplace: "ebay", message: "eBay 401: invalid scope" }],
        }),
      });
    });

    await page.goto("/orders");
    const syncBtn = page.getByRole("button", { name: /Sync/ });
    await expect(syncBtn).toBeVisible();

    await syncBtn.click();

    const banner = page.getByText(/Sync failed: eBay 401: invalid scope/);
    await expect(banner).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "orders-sync-error-banner.png"), fullPage: true });
  });

  test("Sync button shows no failure banner on a clean sync", async ({ page }) => {
    await page.route("**/orders/sync", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ synced: 0, newOrders: [], errors: [] }),
      });
    });

    await page.goto("/orders");
    const syncBtn = page.getByRole("button", { name: /Sync/ });
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    await expect(page.getByText(/Sync failed/)).toHaveCount(0);

    // Reload — the orders page must re-render cleanly after a sync round-trip.
    await page.reload();
    await expect(page.getByRole("button", { name: /Sync/ })).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "orders-sync-clean.png"), fullPage: true });
  });
});

test.describe("login triggers orders sync", () => {
  // Env-bound: the mount-time session exchange needs a dev-bypass API behind
  // the app itself — impossible against the prod-baked container (PR #189),
  // so an ungated local run reports a red that can never pass. CI ephemeral
  // stacks (or a dev-mode :3002) opt in with E2E_ORDERS_SYNC=1.
  test.skip(!process.env.E2E_ORDERS_SYNC, "gated: set E2E_ORDERS_SYNC=1 (needs dev-bypass API behind the app)");

  // Start logged OUT so the real login() callback runs (storageState bypasses it).
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a fresh session exchange fires a fire-and-forget POST /orders/sync", async ({ page }) => {
    let syncCalled = false;
    await page.route("**/orders/sync", async (route) => {
      syncCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ synced: 0, newOrders: [], errors: [] }),
      });
    });

    // Fresh browser context = no sessionStorage sync flag, so the mount-time
    // CF session exchange (dev bypass on the ephemeral API) counts as a login
    // event and fires the background sync.
    await page.goto("/home");

    await expect.poll(() => syncCalled, { timeout: 10_000 }).toBe(true);
  });
});
