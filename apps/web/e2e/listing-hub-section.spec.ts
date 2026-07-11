import { test, expect } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

// Listing-hub Task 2: item detail renders a Marketplace Listings section with a
// ListingCard per listing, and the cross-list CTA replaces the primary CTA once
// a listing exists.
const SHOT = path.join(process.cwd(), "test-results", "proof", "listing-hub");
// Known-good live pair (ASUS ROG item + active eBay listing 307054605978).
const ITEM_ID = "c19d41df-6807-4efc-8436-ea5289f4c4fa";

test.beforeEach(async ({ page }) => {
  await installSessionStub(page);
});

test("item detail shows the Marketplace Listings section and survives reload", async ({ page }) => {
  await page.goto(`/inventory/${ITEM_ID}`);

  const heading = page.getByRole("heading", { name: "Marketplace Listings" });
  await expect(heading).toBeVisible();
  await expect(page.getByText("Active").first()).toBeVisible();
  const link = page.getByRole("link", { name: /view on ebay/i }).first();
  await expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/307054605978");

  // Cross-list demotion: the section replaces the primary CTA once a listing exists.
  await expect(page.getByRole("button", { name: /list on another marketplace/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^List on Marketplace$/ })).toHaveCount(0);

  // Reload — server data, not local state, renders the section.
  await page.reload();
  await expect(heading).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/307054605978");
  await page.screenshot({ path: path.join(SHOT, "1-section.png"), fullPage: true });
});

test("?listing= deep link scrolls the card into view", async ({ page }) => {
  const LISTING_ID = "8c784b48-700b-480d-aed2-60cc4985309e";
  await page.goto(`/inventory/${ITEM_ID}?listing=${LISTING_ID}`);

  const card = page.locator(`#listing-${LISTING_ID}`);
  await expect(card).toBeVisible();
  // The one-shot scroll effect centers the card in the viewport.
  await expect(async () => {
    const box = await card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, "card must be laid out").toBeTruthy();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }).toPass({ timeout: 5_000 });
  await page.screenshot({ path: path.join(SHOT, "2-deeplink.png"), fullPage: false });
});
