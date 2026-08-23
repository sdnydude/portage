import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

/**
 * P3 T12 — LIVE Best Offer repro (the 2026-08-05 blocked price-save) on a real
 * eBay listing. Real Trading API revise, real conflict, real heal. Gated like
 * phase-f-archive-live.spec: never runs in CI; the listing's price is restored
 * in-run. Pass the listing's ITEM id via P3_LIVE_ITEM_ID and a conflicting
 * price via P3_LIVE_CONFLICT_PRICE (below the stored/live auto-accept).
 */
test.skip(!process.env.E2E_EBAY_LIVE, "live eBay — set E2E_EBAY_LIVE=1 to run against the real stack");

const SHOT = path.join(process.cwd(), "test-results", "proof", "p3-ux-truth");
const ITEM_ID = process.env.P3_LIVE_ITEM_ID ?? "";
const CONFLICT_PRICE = process.env.P3_LIVE_CONFLICT_PRICE ?? "";

async function shot(page: Page, name: string, focus?: string) {
  if (focus) await page.getByTestId(focus).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
}

test("live: a price under the Best Offer thresholds is refused by eBay and the guided fix shows the real numbers", async ({ page }) => {
  test.setTimeout(180_000);
  expect(ITEM_ID, "P3_LIVE_ITEM_ID").toBeTruthy();
  expect(CONFLICT_PRICE, "P3_LIVE_CONFLICT_PRICE").toBeTruthy();
  await installSessionStub(page);

  await page.goto(`/inventory/${ITEM_ID}`);
  await page.getByRole("button", { name: /edit price/i }).click();
  const priceInput = page.getByLabel("Price", { exact: true });
  const originalPrice = await priceInput.inputValue();
  await shot(page, "L1-live-price-editor-before.png");

  await priceInput.fill(CONFLICT_PRICE);
  await page.getByRole("button", { name: /^save$/i }).click();

  const banner = page.getByTestId("bo-conflict-banner");
  await expect(banner).toBeVisible({ timeout: 60_000 }); // real GetItem heal + possibly a real revise
  const bannerText = await banner.innerText();
  await shot(page, "L2-live-bo-conflict-banner.png", "bo-conflict-banner");
  console.log("[live] banner:", bannerText.replace(/\s+/g, " "));

  // Guided fix: adjust thresholds to fit the new price, save for real.
  await banner.getByRole("button", { name: /adjust to fit price/i }).click();
  await shot(page, "L3-live-adjusted-to-fit.png");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByTestId("bo-conflict-banner")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0, { timeout: 60_000 });
  await shot(page, "L4-live-saved-after-fix.png");

  // Restore the original price (thresholds already sit under it).
  await page.getByRole("button", { name: /edit price/i }).click();
  await page.getByLabel("Price", { exact: true }).fill(originalPrice);
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0, { timeout: 60_000 });
  await page.reload();
  await expect(page.getByText(new RegExp(`\\$${Number(originalPrice).toLocaleString()}`))).toBeVisible();
  await shot(page, "L5-live-price-restored.png");
});
