import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

async function openCreateSheet(page: Page) {
  await page.goto("/inventory");
  const firstItem = page.locator('a[href^="/inventory/"]').first();
  await expect(firstItem).toBeVisible();
  await firstItem.click();
  await page.getByRole("button", { name: "List on Marketplace" }).click();
}

// F4: the unified CreateListingSheet no longer silently navigates on success.
// A draft save lands on a truthful two-state result screen ("Saved as draft"),
// and its "View listing" button reaches the real persisted listing.
test("F4: create-listing sheet shows a result screen and links the persisted listing", async ({ page }) => {
  await openCreateSheet(page);

  // A price is required before the sheet will save (the seed item has none).
  await page.getByPlaceholder("0.00").fill("42");
  // publish-now stays OFF (default) → the primary action saves a local draft.
  await page.getByRole("button", { name: "Save Draft" }).click();

  // The result screen appears in place of a silent close.
  await expect(page.getByText("Saved as draft", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  const viewListing = page.getByRole("link", { name: "View listing" });
  await expect(viewListing).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "f4-result-draft.png"), fullPage: true });

  // The result links the REAL persisted listing — following it loads the detail
  // page (proves the row was created server-side, not just a local UI flourish).
  await viewListing.click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+$/);
  // Reload the detail page and confirm the listing still resolves (persistence).
  await page.reload();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+$/);
  await page.screenshot({ path: path.join(SHOT_DIR, "f4-result-listing.png"), fullPage: true });
});
