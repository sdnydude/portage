import { test, expect } from "@playwright/test";

// Proves the browser build sends the scoped publish idempotencyKey
// (`${itemId}:${marketplace}:${random}`) through the CreateListingSheet path,
// and that the server persists it on the insert-first row. Draft mode only —
// no marketplace call is made.
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

test("UI draft-save stamps the scoped idempotencyKey on the listing row", async ({ page }) => {
  // Seed a fresh item: an item that already has a listing hides the primary
  // "List on Marketplace" CTA (listing-hub cross-list demotion) and would
  // steer the sheet away from eBay.
  await page.goto("/home");
  const seedToken = (await page.evaluate(() => localStorage.getItem("portage_token")))!;
  const seedHeaders = { Authorization: `Bearer ${seedToken}` };
  const itemRes = await page.request.post(`${API_BASE}/items`, {
    headers: seedHeaders, data: { title: "E2E idempotency item" },
  });
  expect(itemRes.ok(), `item seed failed: ${itemRes.status()}`).toBeTruthy();
  const itemId = (await itemRes.json()).id as string;
  await page.goto(`/inventory/${itemId}`);

  await page.getByRole("button", { name: "List on Marketplace" }).click();
  const sheetPrice = page.getByPlaceholder("0.00");
  await sheetPrice.fill("12.34");
  await page.getByRole("button", { name: "Save Draft" }).click();
  // The sheet becomes the truthful result screen on success.
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();

  // The persisted row must carry the client's scoped key — a bare server-minted
  // UUID here means the browser build did not send one.
  const token = await page.evaluate(() => localStorage.getItem("portage_token"));
  expect(token).toBeTruthy();
  const res = await page.request.get(`${API_BASE}/listings?limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const row = (data.listings as Array<{ itemId: string; idempotencyKey?: string; createdAt: string }>)
    .filter(l => l.itemId === itemId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  expect(row, "no listing row found for the item just drafted").toBeTruthy();
  expect(row.idempotencyKey).toMatch(new RegExp(`^${itemId}:ebay:`));

  // Cleanup the seeded rows (draft listing → no marketplace call on delete).
  const rowId = (row as { id?: string }).id;
  if (rowId) await page.request.delete(`${API_BASE}/listings/${rowId}`, { headers: seedHeaders });
  await page.request.delete(`${API_BASE}/items/${itemId}`, { headers: seedHeaders });
});
