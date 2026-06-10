import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// Save is gated on a real change, so alternate the price each run to stay
// idempotent (always a change, non-accumulating).
const PRICE_A = "111";
const PRICE_B = "222";

// The session comes from auth.setup.ts via storageState — no per-test login
// (the API auth limiter is 10-in-15min and a 7-test suite was exhausting it).
async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("price persists through the item editor and prefills the publish sheet (editable)", async ({ page }) => {
  await login(page);

  await page.goto("/inventory");
  const firstItem = page.locator('a[href^="/inventory/"]').first();
  await expect(firstItem).toBeVisible();
  const href = await firstItem.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);

  // Set an editable price in the inline editor (alternate so Save is enabled).
  await page.getByRole("button", { name: "Edit item" }).click();
  const priceInput = page.getByLabel("Price (USD)");
  await expect(priceInput).toBeVisible();
  const current = await priceInput.inputValue();
  const target = current === PRICE_A ? PRICE_B : PRICE_A;
  await priceInput.fill(target);
  await page.screenshot({ path: path.join(SHOT_DIR, "price-1-editing.png"), fullPage: true });

  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("button", { name: "Edit item" })).toBeVisible();

  // Reload → proves the PATCH persisted to items.price (server round-trip).
  await page.reload();
  await page.getByRole("button", { name: "Edit item" }).click();
  await expect(page.getByLabel("Price (USD)")).toHaveValue(target);
  await page.getByRole("button", { name: "Cancel" }).click();

  // Publish path: the sheet must open prefilled from the set price AND be editable.
  await page.getByRole("button", { name: "List on Marketplace" }).click();
  const sheetPrice = page.getByPlaceholder("0.00");
  await expect(sheetPrice).toHaveValue(target);
  await sheetPrice.fill("999.99");
  await expect(sheetPrice).toHaveValue("999.99");
  await page.screenshot({ path: path.join(SHOT_DIR, "price-2-publish-prefilled.png"), fullPage: true });
});

test("the detail price field allows free keystroke editing (delete the first digit)", async ({ page }) => {
  await login(page);
  await page.goto("/inventory");
  const firstItem = page.locator('a[href^="/inventory/"]').first();
  await expect(firstItem).toBeVisible();
  await page.goto((await firstItem.getAttribute("href"))!);

  await page.getByRole("button", { name: "Edit item" }).click();
  const price = page.getByLabel("Price (USD)");
  await price.fill("250");
  // Delete the FIRST digit via the keyboard (the reported bug: it used to stick).
  await price.press("Home");
  await price.press("Delete");
  await expect(price).toHaveValue("50");
  // And a trailing decimal is preserved mid-edit (not normalized away).
  await price.fill("");
  await price.type("12.");
  await expect(price).toHaveValue("12.");
});
