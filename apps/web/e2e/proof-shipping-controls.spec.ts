import { test, expect } from "@playwright/test";
import path from "node:path";

/**
 * Proof capture for the per-listing shipping controls (beta 17be7322):
 * publish-sheet Shipping section states on the REAL rebuilt container.
 * Screenshot-only — nothing is published, no eBay call is made.
 */
const SHOT_DIR = path.join(process.cwd(), "test-results", "proof", "shipping-controls");

test.describe("proof: publish-sheet shipping controls", () => {
  test("calculated default, flat with cost/service/handling, free hides cost", async ({ page }) => {
    await page.goto("/inventory");
    // First item card (mobile layout: cards are links to /inventory/[id]).
    const first = page.locator('a[href^="/inventory/"]').first();
    await expect(first).toBeVisible();
    await first.click();
    await page.waitForURL("**/inventory/**");

    // Open the publish sheet from whichever CTA the item offers.
    const cta = page
      .getByRole("button", { name: /list on marketplace|list on another marketplace/i })
      .first();
    await expect(cta).toBeVisible();
    await cta.click();

    const methodSelect = page.locator("#shipping-method");
    await expect(methodSelect).toBeVisible();
    await expect(methodSelect).toHaveValue("calculated");
    await page.screenshot({ path: path.join(SHOT_DIR, "1-calculated-default.png"), fullPage: false });

    await methodSelect.selectOption("flat");
    await expect(page.locator("#flat-cost")).toBeVisible();
    await page.locator("#flat-cost").fill("6.50");
    await page.locator("#shipping-service").selectOption("UPSGround");
    await page.locator("#handling-days").fill("3");
    await page.screenshot({ path: path.join(SHOT_DIR, "2-flat-cost-service-handling.png"), fullPage: false });

    await methodSelect.selectOption("free");
    await expect(page.locator("#flat-cost")).toHaveCount(0);
    await expect(page.locator("#shipping-service")).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "3-free-no-cost.png"), fullPage: false });
  });
});
