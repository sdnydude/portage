import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof", "optimizer");

// Session comes from auth.setup.ts via storageState — no per-test login.
async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

// Deterministic, read-only: the optimizer panel renders its heading + Performance
// section regardless of live eBay data (taxonomy/comps just enrich it), so this is
// safe for the standard CI gate. It proves the panel is wired to the research route
// and survives a reload (re-fetch), not just first paint.
test("listing optimizer panel renders on the item detail page and survives reload", async ({ page }) => {
  await login(page);

  await page.goto("/inventory");
  const firstItem = page.locator('a[href^="/inventory/"]').first();
  await expect(firstItem).toBeVisible();
  const href = await firstItem.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);

  // The optimizer mounts and finishes its research fetch (loading → content).
  await expect(page.getByRole("heading", { name: "Listing Optimizer" })).toBeVisible();
  await expect(page.getByText("Item specifics buyers filter on")).toBeVisible();
  await expect(page.getByText("Performance")).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "1-optimizer-rendered.png"), fullPage: true });

  // Reload → proves the panel re-fetches and renders from the server, not just
  // transient first-render state.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Listing Optimizer" })).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "2-after-reload.png"), fullPage: true });
});
