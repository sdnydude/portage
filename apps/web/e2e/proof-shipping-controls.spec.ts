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
    // 2-day expedited services present (probe-verified enums).
    await expect(page.locator('#shipping-service option[value="FedEx2Day"]')).toHaveCount(1);
    await expect(page.locator('#shipping-service option[value="UPS2ndDay"]')).toHaveCount(1);
    // Local pickup add-on toggle present; flip it on for the capture and
    // ASSERT the on-state (a silent no-op click would fake the proof).
    const pickupTrack = page.locator('label:has-text("Offer local pickup") > div').first();
    await pickupTrack.click();
    await expect(pickupTrack).toHaveClass(/bg-forest-green/);
    await page.locator("#shipping-service").selectOption("UPSGround");
    await page.locator("#handling-days").fill("3");
    // Re-assert right before capture: the flag must survive the later edits.
    await expect(pickupTrack).toHaveClass(/bg-forest-green/);
    await page.screenshot({ path: path.join(SHOT_DIR, "2-flat-cost-service-handling.png"), fullPage: false });

    await methodSelect.selectOption("free");
    await expect(page.locator("#flat-cost")).toHaveCount(0);
    await expect(page.locator("#shipping-service")).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "3-free-no-cost.png"), fullPage: false });
  });

  test("Reverb: shipping profile select with default + pickup options", async ({ page }) => {
    await page.goto("/inventory");
    const first = page.locator('a[href^="/inventory/"]').first();
    await expect(first).toBeVisible();
    await first.click();
    await page.waitForURL("**/inventory/**");
    await page
      .getByRole("button", { name: /list on marketplace|list on another marketplace/i })
      .first()
      .click();

    await page.getByRole("button", { name: "Reverb" }).click();
    const profileSelect = page.locator("#reverb-shipping-profile");
    await expect(profileSelect).toBeVisible();
    // Unconnected account: fetch fails gracefully — default + pickup remain.
    await expect(profileSelect.locator("option")).toContainText([/seller profile default/i, /local pickup only/i]);
    await profileSelect.selectOption("pickup");
    // Let the marketplace-pill color transition finish before capturing.
    await expect(page.getByRole("button", { name: "Reverb", exact: true })).toHaveClass(/bg-forest-green/);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOT_DIR, "4-reverb-pickup-only.png"), fullPage: false });
  });

  test("listing-card Edit shipping opens the seeded inline editor", async ({ page }) => {
    await page.goto("/inventory");
    const first = page.locator('a[href^="/inventory/"]').first();
    await expect(first).toBeVisible();
    await first.click();
    await page.waitForURL("**/inventory/**");

    // Create a local eBay draft so the item page shows a listing card.
    await page
      .getByRole("button", { name: /list on marketplace|list on another marketplace/i })
      .first()
      .click();
    await page.getByPlaceholder("0.00").fill("25");
    await page.getByRole("button", { name: /^save draft$/i }).click();
    await page.getByRole("button", { name: "Done" }).click();

    const editShipping = page.getByRole("button", { name: /edit shipping/i }).first();
    await expect(editShipping).toBeVisible();
    await editShipping.click();
    const method = page.locator('select[id$="shipping-method"]').last();
    await method.selectOption("flat");
    await page.locator('input[id$="flat-cost"]').last().fill("9.99");
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOT_DIR, "5-listing-card-shipping-edit.png"), fullPage: false });
  });
});
