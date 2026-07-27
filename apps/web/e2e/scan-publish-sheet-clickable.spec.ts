import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { installSessionStub } from "./session-stub";

const SHOT = path.join(process.cwd(), "test-results", "proof", "sheet-clickable");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

// Beta report 7c9a499b: on Save & List the publish-confirm sheet's bottom
// buttons were covered by the scan-review action bar (both fixed-bottom, bar at
// z-[70] over the sheet) — clicks landed on the bar, not the sheet. Fix hides
// ScanReviewActions while the sheet is open. Playwright's click actionability
// check fails on intercepted pointer events, so a plain click IS the assertion.
const CANDIDATE = {
  name: "E2E Sheet Clickable Widget",
  category: "electronics",
  condition: "good",
  conditionNotes: "",
  description: "Fixture item for the sheet-clickability regression e2e.",
  estimatedValueLow: 40,
  estimatedValueHigh: 60,
  brand: "Acme",
  model: "SC-1",
  features: [],
  confidence: 0.9,
};

test("Save & List: publish sheet buttons are clickable (action bar yields)", async ({ page, request }) => {
  test.setTimeout(120_000);
  let itemId: string | null = null;

  // Token straight from the setup project's storage state — immune to the
  // first-load navigation race that kills page.evaluate on /home.
  const storage = JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "user.json"), "utf8"));
  const token = storage.origins[0].localStorage.find(
    (e: { name: string }) => e.name === "portage_token",
  )!.value as string;
  // On a CF-less target the mount exchange 401s against the prod-mode API and
  // wipes the seeded session — stub only that edge exchange (data calls stay
  // real).
  await installSessionStub(page);

  // Deterministic AI + taxonomy boundaries (POST/GET-only guards; never
  // navigations). Routes are registered BEFORE goto: flipping the page into
  // interception mode mid-load aborts in-flight fetches, and one aborted
  // /backend call cascades into a session-exchange logout on the CF-less
  // e2e target.
  await page.route(/\/scan\/refine$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        identification: CANDIDATE,
        detailed: { candidates: [CANDIDATE], reasoning: ["e2e fixture"] },
      }),
    });
  });
  await page.route(/\/marketplace\/ebay\/category-suggestion/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        suggestion: { categoryId: "e2e-cat-1", categoryName: "E2E Category", conditionIds: [] },
      }),
    });
  });
  await page.route(/\/marketplace\/ebay\/category-aspects\//, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ aspects: {} }) });
  });
  // Storage boundary too: the ephemeral CI stack has no R2 credentials, so a
  // real POST /images 500s and the flow never leaves the capture state. A 1px
  // data: URI keeps the run offline-deterministic.
  const PIXEL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await page.route(/\/images$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        image: { url: PIXEL, key: "e2e-sheet-clickable-photo", width: 640, height: 640 },
        thumbnail: { url: PIXEL, key: "e2e-sheet-clickable-thumb" },
      }),
    });
  });

  // /inventory, not /home: a fresh user (ephemeral CI) gets the full-screen
  // OnboardingFlow on /home, which intercepts the Scan FAB click. The TabBar
  // (and its Scan button) mounts on every non-admin route.
  await page.goto("/inventory");

  try {
    await test.step("scan to review and Save & List", async () => {
      await page.getByRole("button", { name: "Scan item" }).click();
      await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));
      await page.getByRole("button", { name: /Scan \d+ Photo/ }).click();

      const priceInput = page.getByLabel("Price (USD)");
      await expect(priceInput).toBeVisible({ timeout: 60_000 });
      await priceInput.fill("42");
      const saveAndList = page.getByRole("button", { name: "Save & List" });
      await expect(saveAndList).toBeEnabled({ timeout: 30_000 });
      await page.screenshot({ path: path.join(SHOT, "1-review.png"), fullPage: true });

      const [itemsResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/items"),
          { timeout: 30_000 },
        ),
        saveAndList.click(),
      ]);
      expect(itemsResp.ok()).toBeTruthy();
      itemId = (await itemsResp.json())?.id ?? null;
    });

    await test.step("sheet is up, action bar yields, sheet buttons take clicks", async () => {
      await expect(page.getByRole("heading", { name: "Create Listing" })).toBeVisible({ timeout: 30_000 });
      // The regression: this bar used to stay mounted on top of the sheet.
      await expect(page.getByRole("button", { name: "Rescan" })).toBeHidden();
      await page.screenshot({ path: path.join(SHOT, "2-sheet-open.png"), fullPage: true });

      // Actionability = the fix. With the bar covering the sheet, this click
      // times out on "intercepts pointer events".
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("heading", { name: "Create Listing" })).toBeHidden();
      // Closing the sheet restores the action bar.
      await expect(page.getByRole("button", { name: "Rescan" })).toBeVisible();
      await page.screenshot({ path: path.join(SHOT, "3-after-cancel.png"), fullPage: true });
    });
  } finally {
    if (itemId) {
      await request.delete(`${API_BASE}/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
});
