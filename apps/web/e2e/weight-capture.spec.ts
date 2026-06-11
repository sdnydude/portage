import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// Save is gated on a real change (canSaveItemEdit), so the test must mutate the
// value each run. We alternate the pounds between two values based on the current
// persisted state; this keeps the test idempotent (non-accumulating, always a
// change) without needing to clear weight — the route rejects a null weightOz.
const OZ = "8";
const DIMS = { L: "12", W: "9", H: "5" };

// The session comes from auth.setup.ts via storageState — no per-test login
// (the API auth limiter is 10-in-15min and a 7-test suite was exhausting it).
async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("weight + dimensions persist through the inline item editor and a reload", async ({ page }) => {
  await login(page);

  // Open the first inventory item deterministically.
  await page.goto("/inventory");
  const firstItem = page.locator('a[href^="/inventory/"]').first();
  await expect(firstItem).toBeVisible();
  const href = await firstItem.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);

  // Enter inline edit mode. Pick a pounds value that differs from the current one
  // so Save (gated on a real change) is always enabled.
  await page.getByRole("button", { name: "Edit item" }).click();
  const lb = page.getByLabel("Pounds", { exact: true });
  await expect(lb).toBeVisible();
  const currentLb = await lb.inputValue();
  const targetLb = currentLb === "3" ? "4" : "3";

  await lb.fill(targetLb);
  await page.getByLabel("Ounces", { exact: true }).fill(OZ);
  await page.getByLabel("L inches", { exact: true }).fill(DIMS.L);
  await page.getByLabel("W inches", { exact: true }).fill(DIMS.W);
  await page.getByLabel("H inches", { exact: true }).fill(DIMS.H);
  await page.screenshot({ path: path.join(SHOT_DIR, "weight-1-editing.png"), fullPage: true });

  // Save → returns to the read-only detail view.
  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("button", { name: "Edit item" })).toBeVisible();

  // Reload → proves the PATCH persisted to the item columns (server round-trip),
  // not just local React state. Re-open edit mode and assert the hydrated values.
  await page.reload();
  await page.getByRole("button", { name: "Edit item" }).click();
  await expect(page.getByLabel("Pounds", { exact: true })).toHaveValue(targetLb);
  await expect(page.getByLabel("Ounces", { exact: true })).toHaveValue(OZ);
  await expect(page.getByLabel("L inches", { exact: true })).toHaveValue(DIMS.L);
  await expect(page.getByLabel("W inches", { exact: true })).toHaveValue(DIMS.W);
  await expect(page.getByLabel("H inches", { exact: true })).toHaveValue(DIMS.H);
  await page.screenshot({ path: path.join(SHOT_DIR, "weight-2-persisted-after-reload.png"), fullPage: true });
});
