import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { installSessionStub } from "./session-stub";

/**
 * Deferral P3 — beta UX truth (docs/deferral-plan-2026-08-15.md §P3).
 *
 * Every silent failure / silent mutation on the scan → price → publish path
 * must now be TOLD. Outages are produced at the network boundary
 * (page.route on host-agnostic path globs — the CI stack calls the API
 * directly, the LAN stack goes through /backend/*), the app's own wiring is
 * real. No eBay traffic.
 */
const SHOT = path.join(process.cwd(), "test-results", "proof", "p3-ux-truth");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";
const DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? "portage-e2e-db-1";
const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@portage.app";

const CANDIDATE = {
  name: "E2E P3 Truth Fender Stratocaster",
  description: "Electric guitar captured by the P3 truth e2e.",
  category: "electronics",
  condition: "good",
  conditionNotes: "",
  estimatedValueLow: 400,
  estimatedValueHigh: 600,
  brand: "Fender",
  model: "Stratocaster",
  features: [],
  confidence: 0.9,
};

/** Viewport shot (the scan flow is a modal — fullPage would capture the page beneath it). */
async function shot(page: Page, name: string, focus?: string) {
  if (focus) await page.getByTestId(focus).scrollIntoViewIfNeeded();
  await page
    .waitForFunction(() => Array.from(document.images).every((i) => i.complete), undefined, { timeout: 4000 })
    .catch(() => {});
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
}

/** Upload the fixture through the gallery picker and land on Review. */
async function scanToReview(page: Page) {
  await page.route(/\/images$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ image: { url: "https://picsum.photos/seed/p3truth/640/640", key: "e2e/p3.jpg", width: 640, height: 640 } }),
    });
  });
  await page.route(/\/scan\/refine$/, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ detailed: { candidates: [CANDIDATE], reasoning: "e2e fixture" } }) }),
  );
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));
  await page.getByRole("button", { name: /Scan 1 Photo/ }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await installSessionStub(page);
});

test("scan review tells the truth: comps outage, condition snap, aspect-schema outage with retry, honest List gate", async ({ page }) => {
  test.setTimeout(120_000);
  let aspectsCalls = 0;
  await page.route(/\/items\/comps\/search/, (route) => route.fulfill({ status: 500, body: "{}" }));
  // Category accepts New only (1000) → the Good candidate snaps to New.
  await page.route(/\/marketplace\/ebay\/category-suggestion/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ suggestion: { categoryId: "33034", categoryName: "Electric Guitars", conditionIds: ["1000"] } }),
    }),
  );
  // First schema fetch fails, the retry succeeds.
  await page.route(/\/marketplace\/ebay\/category-aspects\//, (route) => {
    aspectsCalls += 1;
    if (aspectsCalls === 1) return route.fulfill({ status: 503, body: "{}" });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ aspects: {} }) });
  });

  await scanToReview(page);

  await expect(page.getByTestId("comps-error")).toHaveText(/Comps unavailable — using AI estimate only/);
  await expect(page.getByTestId("condition-notice")).toHaveText(/Condition adjusted to New — Good isn't offered in this category/);
  await expect(page.getByTestId("aspects-error")).toContainText(/eBay category details unavailable/);
  // The specifics header must not claim "Complete" for a schema it never got.
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Complete", { exact: true })).toHaveCount(0);
  // List is gated with the honest reason — not "complete", not "checking".
  await expect(page.getByText(/eBay category details unavailable — retry before listing/)).toBeVisible();
  await shot(page, "1-scan-review-outages-told.png", "condition-notice");
  await shot(page, "1b-scan-review-aspects-outage.png", "aspects-error");

  await page.getByTestId("aspects-error").getByRole("button", { name: /retry/i }).click();
  await expect(page.getByTestId("aspects-error")).toHaveCount(0);
  await expect(page.getByText("Complete", { exact: true })).toBeVisible();
  expect(aspectsCalls).toBe(2);
  await shot(page, "2-aspects-retry-cleared.png", "comps-error");

  // Picking a condition chip clears the snap notice.
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByTestId("condition-notice")).toHaveCount(0);
});

test("category lookup outage is told separately from a genuine no-match, with a retry", async ({ page }) => {
  test.setTimeout(120_000);
  let lookups = 0;
  await page.route(/\/items\/comps\/search/, (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.route(/\/marketplace\/ebay\/category-suggestion/, (route) => {
    lookups += 1;
    if (lookups === 1) return route.fulfill({ status: 503, body: "{}" });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ suggestion: null }) });
  });

  await scanToReview(page);

  await expect(page.getByTestId("resolve-error")).toContainText(/Category lookup failed/);
  await expect(page.getByText(/No eBay category matched/)).toHaveCount(0);
  await shot(page, "3-category-lookup-failed.png", "resolve-error");

  await page.getByRole("button", { name: /retry lookup/i }).click();
  await expect(page.getByTestId("resolve-error")).toHaveCount(0);
  await expect(page.getByText(/No eBay category matched/)).toBeVisible();
  await shot(page, "4-category-no-match-after-retry.png");
});

test.describe("mobile deep link", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("?item= below lg never mounts the hidden pane — no item fetch", async ({ page, request }) => {
    const token = (await page.context().storageState()).origins
      .flatMap((o) => o.localStorage)
      .find((e) => e.name === "portage_token")?.value;
    const created = await request.post(`${API_BASE}/items`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { title: "E2E P3 Deep Link", description: "", category: "other", condition: "good", quantity: 1, photos: [] },
    });
    expect(created.ok(), `POST /items ${created.status()}`).toBeTruthy();
    const itemId = (await created.json()).id as string;
    try {
      const detailFetches: string[] = [];
      page.on("request", (r) => {
        const p = new URL(r.url()).pathname;
        if (r.method() === "GET" && p.endsWith(`/items/${itemId}`)) detailFetches.push(p);
      });
      await page.goto(`/inventory?item=${itemId}`);
      await expect(page.getByText("E2E P3 Deep Link").first()).toBeVisible();
      await page.waitForTimeout(1500);
      expect(detailFetches).toEqual([]);
      await shot(page, "5-mobile-deep-link-no-pane.png");
    } finally {
      await request.delete(`${API_BASE}/items/${itemId}`, { headers: { Authorization: `Bearer ${token}` } });
    }
  });
});

test.describe("Best Offer guided fix", () => {
  // Seeded listing row, proof-best-offer.spec pattern: the 422 comes from the
  // real pre-flight, the banner + actions are the P3 surface under test.
  const ITEM_ID = "00000000-0000-4000-8000-000000000c01";
  const LISTING_ID = "00000000-0000-4000-8000-000000000c02";

  function psql(sql: string): string {
    return execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "portage", "-d", "portage", "-t", "-A", "-c", sql], { encoding: "utf8" }).trim();
  }
  function cleanup() {
    psql(`DELETE FROM marketplace_sync_log WHERE listing_id = '${LISTING_ID}'`);
    psql(`DELETE FROM sync_jobs WHERE listing_id = '${LISTING_ID}'`);
    psql(`DELETE FROM listings WHERE id = '${LISTING_ID}'`);
    psql(`DELETE FROM items WHERE id = '${ITEM_ID}'`);
  }

  test.beforeAll(() => {
    const userId = psql(`SELECT id FROM users WHERE email = '${E2E_USER_EMAIL.replace(/'/g, "''")}' LIMIT 1`);
    expect(userId, `${E2E_USER_EMAIL} must exist (auth.setup provisions it)`).toBeTruthy();
    cleanup();
    psql(`INSERT INTO items (id, user_id, title, description, category, condition, quantity, price)
          VALUES ('${ITEM_ID}', '${userId}', 'E2E P3 Best Offer Guitar', 'proof seed', 'electronics', 'good', 1, 219)`);
    psql(`INSERT INTO listings (id, item_id, user_id, marketplace, marketplace_listing_id, status, price, currency, marketplace_specific_fields)
          VALUES ('${LISTING_ID}', '${ITEM_ID}', '${userId}', 'ebay', '99000000002', 'active', 219, 'USD',
                  '{"categoryId":"33034","bestOfferEnabled":true,"bestOfferAutoAcceptPrice":209,"minimumBestOfferPrice":199}'::jsonb)`);
  });
  test.afterAll(() => cleanup());

  test("conflict renders the guided banner; Adjust to fit price rewrites thresholds below the new price and the save persists", async ({ page }) => {
    await page.goto(`/inventory/${ITEM_ID}`);
    await page.getByRole("button", { name: /edit price/i }).click();
    await page.getByLabel("Price", { exact: true }).fill("199");
    await page.getByRole("button", { name: /^save$/i }).click();

    const banner = page.getByTestId("bo-conflict-banner");
    // The pre-flight heal does one GetItem; with real creds on a LAN run that
    // round-trip is slow (bogus id), on the credless CI stack it no-ops.
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toContainText(/auto-accept \$209/);
    await expect(banner).toContainText(/minimum \$199/);
    await shot(page, "6-bo-conflict-guided-banner.png", "bo-conflict-banner");

    await banner.getByRole("button", { name: /adjust to fit price/i }).click();
    await expect(page.getByLabel(/auto-accept price/i)).toHaveValue("179.1");
    await expect(page.getByLabel(/minimum offer price/i)).toHaveValue("159.2");
    await expect(page.getByText(/Offer settings adjusted — Save to confirm/)).toBeVisible();
    await shot(page, "7-bo-adjusted-to-fit.png");

    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByTestId("bo-conflict-banner")).toHaveCount(0);
    // The local save is the proof target (no marketplace creds on this stack).
    await expect.poll(() => psql(`SELECT price FROM listings WHERE id = '${LISTING_ID}'`)).toBe("199");
    expect(psql(`SELECT marketplace_specific_fields->>'bestOfferAutoAcceptPrice' FROM listings WHERE id = '${LISTING_ID}'`)).toBe("179.1");
    await page.reload();
    await page.getByRole("button", { name: /edit price/i }).click();
    await expect(page.getByLabel(/auto-accept price/i)).toHaveValue("179.1");
    await shot(page, "8-bo-fix-persisted-after-reload.png");
  });
});
