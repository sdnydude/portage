import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

/**
 * Portage batch 2026-09-06 — Phase 2 proof (plan Task 2.3).
 *
 * Runs against the ISOLATED e2e stack (docker-compose.e2e.yml) seeded with 201
 * items, one of them carrying a MULTI "Features" aspect. Screenshots land under
 * test-results/proof/batch/ in light and dark. Network stubs sit at the boundary
 * (no eBay traffic); everything else is the real app.
 */
const SHOT = path.join(process.cwd(), "test-results", "proof", "batch");
type Theme = "light" | "dark";
const THEME = (process.env.E2E_THEME === "dark" ? "dark" : "light") as Theme;

/** Force the theme before the app's theme-init script runs (it honours the stored override). */
async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => {
    try { localStorage.setItem("theme", t); } catch { /* ignore */ }
  }, theme);
}

async function shot(page: Page, name: string) {
  await page
    .waitForFunction(() => Array.from(document.images).every((i) => i.complete), undefined, { timeout: 4000 })
    .catch(() => {});
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
}

async function expectHeaderCluster(page: Page) {
  await expect(page.getByRole("button", { name: /Switch to (light|dark) mode/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Settings/ }).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installSessionStub(page);
  await useTheme(page, THEME);
});

test(`inventory paginates 201 items: page 2 at 25/page, page 3 at 100/page (${THEME})`, async ({ page }) => {
  await page.goto("/inventory");
  const select = page.getByLabel("Items per page").first();
  await expect(select).toBeVisible();
  await select.selectOption("25");
  await expect(page.getByText("1–25 of 201").first()).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).first().click();
  await expect(page.getByText("26–50 of 201").first()).toBeVisible();
  await shot(page, `inventory-p2-of-25-${THEME}.png`);

  await select.selectOption("100");
  await expect(page.getByText("1–100 of 201").first()).toBeVisible(); // size change resets to page 1
  await page.getByRole("button", { name: "Next page" }).first().click();
  await page.getByRole("button", { name: "Next page" }).first().click();
  await expect(page.getByText("201–201 of 201").first()).toBeVisible();
  await shot(page, `inventory-p3-of-100-${THEME}.png`);
  await expectHeaderCluster(page);
});

test(`header cluster on inventory, item detail, edit, settings profile, Porter (${THEME})`, async ({ page }) => {
  await page.goto("/inventory");
  await expectHeaderCluster(page);
  await shot(page, `header-inventory-${THEME}.png`);

  // First seeded item card on page 1 (newest first) → detail (mobile cards navigate to /inventory/:id).
  await page.getByText(/^E2E Item \d{3}$/).first().click();
  await expect(page).toHaveURL(/\/inventory\/[0-9a-f-]{36}/);
  await expectHeaderCluster(page);
  await shot(page, `header-item-detail-${THEME}.png`);

  const id = page.url().match(/\/inventory\/([0-9a-f-]{36})/)![1];
  await page.goto(`/inventory/${id}/edit`);
  await expectHeaderCluster(page);
  await shot(page, `header-edit-${THEME}.png`);

  await page.goto("/settings/profile");
  await expectHeaderCluster(page);
  await shot(page, `header-settings-profile-${THEME}.png`);

  await page.goto("/porter");
  await expectHeaderCluster(page);
  await shot(page, `header-porter-${THEME}.png`);
});

const CANDIDATE = {
  name: "E2E Batch AirPods Max",
  description: "Over-ear headphones captured by the batch proof e2e.",
  category: "electronics",
  condition: "good",
  conditionNotes: "",
  estimatedValueLow: 300,
  estimatedValueHigh: 400,
  brand: "Apple",
  model: "A2096",
  features: [],
  confidence: 0.9,
};

/** Upload the fixture through the gallery picker and land on Review, with a MULTI aspect and a comps outage stubbed. */
async function scanToReview(page: Page) {
  await page.route(/\/images$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ image: { url: "https://picsum.photos/seed/batch/640/640", key: "e2e/batch.jpg", width: 640, height: 640 } }),
    });
  });
  await page.route(/\/scan\/refine$/, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ detailed: { candidates: [CANDIDATE], reasoning: "e2e fixture" } }) }),
  );
  // Comps outage → the warning-toned comps-error notice renders (light-mode contrast proof).
  await page.route(/\/items\/comps\/search/, (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.route(/\/marketplace\/ebay\/category-suggestion/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ suggestion: { categoryId: "112529", categoryName: "Headphones", conditionIds: ["3000"] } }),
    }),
  );
  await page.route(/\/marketplace\/ebay\/category-aspects\//, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        aspects: {
          Features: { required: false, values: ["Wireless", "Bluetooth", "Noise Cancellation", "Foldable"], cardinality: "MULTI" },
          Color: { required: true, values: ["Sky Blue", "Space Gray", "Silver"], cardinality: "SINGLE" },
        },
      }),
    }),
  );
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));
  await page.getByRole("button", { name: /Scan 1 Photo/ }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible({ timeout: 20_000 });
}

test(`scan review: MULTI aspect keeps several chips, warning notice legible, header cluster present (${THEME})`, async ({ page }) => {
  test.setTimeout(120_000);
  await scanToReview(page);
  await expect(page.getByTestId("comps-error")).toHaveText(/Comps unavailable/);
  await expectHeaderCluster(page);

  // Optional aspects (Features is not required) are collapsed behind a toggle.
  await page.getByRole("button", { name: /Show 1 optional detail/ }).click();
  await page.getByRole("button", { name: "Wireless" }).click();
  await page.getByRole("button", { name: "Bluetooth" }).click();
  await page.getByRole("button", { name: "Noise Cancellation" }).click();
  await expect(page.getByText("3 selected")).toBeVisible();
  await page.getByText("3 selected").scrollIntoViewIfNeeded();
  await shot(page, `scan-review-multi-aspect-${THEME}.png`);

  await page.getByTestId("comps-error").scrollIntoViewIfNeeded();
  await shot(page, `scan-review-warning-notice-${THEME}.png`);
});
