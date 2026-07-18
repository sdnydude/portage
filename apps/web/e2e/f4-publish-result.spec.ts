import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

async function openCreateSheet(page: Page) {
  // Seed a fresh item: an item that already has a listing hides the primary
  // "List on Marketplace" CTA (listing-hub cross-list demotion).
  await page.goto("/home");
  const token = (await page.evaluate(() => localStorage.getItem("portage_token")))!;
  const itemRes = await page.request.post(`${API_BASE}/items`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "E2E f4 result item" },
  });
  expect(itemRes.ok(), `item seed failed: ${itemRes.status()}`).toBeTruthy();
  const itemId = (await itemRes.json()).id as string;
  await page.goto(`/inventory/${itemId}`);
  await page.getByRole("button", { name: "List on Marketplace" }).click();
  return { itemId, token };
}

// F4: the unified CreateListingSheet no longer silently navigates on success.
// A draft save lands on a truthful two-state result screen ("Saved as draft"),
// and its "View listing" button reaches the real persisted listing.
test("F4: create-listing sheet shows a result screen and links the persisted listing", async ({ page }) => {
  const seed = await openCreateSheet(page);
  try {

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

  // The result links the REAL persisted listing — following it lands on the
  // item hub's deep link (listing-hub Task 4 retarget; proves the row was
  // created server-side, not just a local UI flourish).
  await viewListing.click();
  await expect(page).toHaveURL(/\/inventory\/[0-9a-f-]+\?listing=[0-9a-f-]+$/);
  // Reload and confirm the hub still resolves the listing (persistence).
  await page.reload();
  await expect(page).toHaveURL(/\/inventory\/[0-9a-f-]+\?listing=[0-9a-f-]+$/);
  await page.screenshot({ path: path.join(SHOT_DIR, "f4-result-listing.png"), fullPage: true });
  } finally {
    // Cleanup seeded rows (draft listing first via the itemId filter, then item).
    const headers = { Authorization: `Bearer ${seed.token}` };
    const res = await page.request.get(`${API_BASE}/listings?itemId=${seed.itemId}`, { headers });
    if (res.ok()) {
      for (const l of ((await res.json()).listings as Array<{ id: string }>)) {
        await page.request.delete(`${API_BASE}/listings/${l.id}`, { headers });
      }
    }
    await page.request.delete(`${API_BASE}/items/${seed.itemId}`, { headers });
  }
});
