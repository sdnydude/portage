import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("F3b: the publish terms sheet shows the 'don't show for 7 days' checkbox", async ({ page }) => {
  // The publish flow ("List on Marketplace" -> "Review Terms") requires a connected
  // marketplace, which the fresh ephemeral CI user lacks. Opt in via E2E_EBAY_LIVE.
  test.skip(!process.env.E2E_EBAY_LIVE, "Requires a connected-marketplace publish flow; set E2E_EBAY_LIVE=1 to run");
  await login(page);
  await page.goto("/inventory");
  const firstItem = page.locator('a[href^="/inventory/"]').first();
  await expect(firstItem).toBeVisible();
  await firstItem.click();

  await page.getByRole("button", { name: "List on Marketplace" }).click();
  // Turn on publish-now → the primary action becomes "Review Terms" (not suppressed).
  // The toggle's onClick lives on the styled div inside the label, not the text.
  await page.locator("label", { hasText: "Publish immediately" }).locator("div").first().click();
  await page.getByRole("button", { name: "Review Terms" }).click();

  // The terms sheet (F3b) shows the opt-in suppression checkbox.
  await expect(page.getByLabel("Don't show again for 7 days")).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "f3b-terms-checkbox.png"), fullPage: true });
});
