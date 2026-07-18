import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SENTINEL = "E2E-INLINE-EDIT";
const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// The session comes from auth.setup.ts via storageState — no per-test login
// (the API auth limiter is 10-in-15min and a 7-test suite was exhausting it).
async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("inline edit persists a brand change on the item detail panel", async ({ page }) => {
  await login(page);

  // Open the first inventory item deterministically.
  await page.goto("/inventory");
  const firstItem = page.locator('a[href^="/inventory/"]').first();
  await expect(firstItem).toBeVisible();
  const href = await firstItem.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);

  // Read-only state.
  const editButton = page.getByRole("button", { name: "Edit item" });
  await expect(editButton).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "1-readonly.png"), fullPage: true });

  // Enter edit mode, capture the original brand, set the sentinel.
  await editButton.click();
  const brandInput = page.getByPlaceholder("e.g. Sony, Nike");
  await expect(brandInput).toBeVisible();
  const originalBrand = await brandInput.inputValue();
  await brandInput.fill(SENTINEL);
  await page.screenshot({ path: path.join(SHOT_DIR, "2-editing.png"), fullPage: true });

  // Save → the read-only view must reflect the change.
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit item" })).toBeVisible();
  await expect(page.getByText(SENTINEL)).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "3-saved.png"), fullPage: true });

  // Reload → proves the PATCH actually persisted, not just local React state.
  await page.reload();
  await expect(page.getByText(SENTINEL)).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "4-persisted-after-reload.png"), fullPage: true });

  // Cleanup: restore the original brand so the test is repeatable + non-destructive.
  await page.getByRole("button", { name: "Edit item" }).click();
  await page.getByPlaceholder("e.g. Sony, Nike").fill(originalBrand);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit item" })).toBeVisible();
});
