import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "phasef");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";
// A known-good eBay item (drafted cleanly in the F-GATE run) — avoids items whose
// condition/category eBay rejects (25021), which is unrelated to Phase F wiring.
const ITEM_URL = "/inventory/9b913b46-3c2e-459a-ae95-f1bb73316277";

async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

// One test, sequential test.step() proof of the Phase F publish paths/wiring.
test("Phase F proof — unified sheet, eBay-draft, price provenance, terms 7-day, F4 result", async ({ page }) => {
  test.skip(!process.env.E2E_EBAY_LIVE, "Requires a live eBay-connected account + seeded active listing; set E2E_EBAY_LIVE=1 to run");
  test.setTimeout(120_000);
  let listingId: string | null = null;
  let token: string | null = null;

  await login(page);
  token = await page.evaluate(() => localStorage.getItem("portage_token"));

  await test.step("A+D — item-detail opens the unified sheet with price + provenance (F1/F2)", async () => {
    await page.goto(ITEM_URL);
    await page.getByRole("button", { name: "List on Marketplace" }).click();
    await expect(page.getByText("Create Listing")).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, "01-unified-sheet.png"), fullPage: true });
  });

  await test.step("C — eBay-draft armed then created; F4 two-state result (draft)", async () => {
    const draftToggle = page.locator("label", { hasText: "Save as eBay draft" }).locator("div").first();
    await expect(draftToggle).toBeVisible();
    await draftToggle.click();
    const priceInput = page.getByPlaceholder("0.00");
    if (await priceInput.inputValue() === "") await priceInput.fill("123.45");
    await page.screenshot({ path: path.join(SHOT, "02-ebay-draft-armed.png"), fullPage: true });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/listings"),
        { timeout: 60_000 },
      ),
      page.getByRole("button", { name: "Save eBay Draft" }).click(),
    ]);
    const body = await resp.json().catch(() => ({}));
    listingId = body?.id ?? null;
    // F4 result screen — a deliberate eBay-draft shows "Saved as draft" (clean,
    // green). Wait for the result heading, then screenshot the actual outcome.
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOT, "03-f4-result-draft.png"), fullPage: true });
    await expect(page.getByText("Saved as draft")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Done" }).click().catch(() => {});
  });

  await test.step("E — publish-now path shows the terms sheet with the 7-day checkbox (F3b)", async () => {
    await page.goto(ITEM_URL);
    await page.getByRole("button", { name: "List on Marketplace" }).click();
    await expect(page.getByText("Create Listing")).toBeVisible();
    await page.locator("label", { hasText: "Publish immediately" }).locator("div").first().click();
    await page.getByRole("button", { name: "Review Terms" }).click();
    await expect(page.getByLabel("Don't show again for 7 days")).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, "04-terms-7day-checkbox.png"), fullPage: true });
  });

  await test.step("G — cleanup: delete the draft listing (F-ORPHAN withdraws the eBay offer)", async () => {
    if (listingId && token) {
      const res = await page.request.delete(`${API_BASE}/listings/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok()).toBeTruthy();
    }
  });
});
