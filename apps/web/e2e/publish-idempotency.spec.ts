import { test, expect } from "@playwright/test";
import { installSessionStub } from "./session-stub";

// Proves the browser build sends the scoped publish idempotencyKey
// (`${itemId}:${marketplace}:${random}`) through the CreateListingSheet path,
// and that the server persists it on the insert-first row. Draft mode only —
// no marketplace call is made.
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

test("UI draft-save stamps the scoped idempotencyKey on the listing row", async ({ page }) => {
  // CF-less target: the mount exchange would 401 on the prod-mode API and
  // wipe the seeded session (the old version merely won that race).
  await installSessionStub(page);
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
  let rowId: string | undefined;
  try {
    await page.goto(`/inventory/${itemId}`);

    await page.getByRole("button", { name: "List on Marketplace" }).click();
    const sheetPrice = page.getByPlaceholder("0.00");
    await sheetPrice.fill("12.34");
    await page.getByRole("button", { name: "Save Draft" }).click();
    // The sheet becomes the truthful result screen on success.
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();

    // The persisted row must carry the client's scoped key — a bare server-minted
    // UUID here means the browser build did not send one. Query by itemId — a
    // global limit can push the fresh row off the first page on a busy stack.
    const res = await page.request.get(`${API_BASE}/listings?itemId=${itemId}`, { headers: seedHeaders });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const row = (data.listings as Array<{ id: string; itemId: string; idempotencyKey?: string; createdAt: string }>)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    expect(row, "no listing row found for the item just drafted").toBeTruthy();
    rowId = row.id;
    expect(row.idempotencyKey).toMatch(new RegExp(`^${itemId}:ebay:`));
  } finally {
    // Cleanup the seeded rows even on failure (draft listing → no marketplace
    // call on delete). Each delete is attempted independently and failures are
    // surfaced at the end via expect.soft (reported without masking the test's
    // own error).
    const cleanupFailures: string[] = [];
    try {
      if (!rowId) {
        const res = await page.request.get(`${API_BASE}/listings?itemId=${itemId}`, { headers: seedHeaders });
        if (res.ok()) rowId = ((await res.json()).listings as Array<{ id: string }>)[0]?.id;
      }
      if (rowId) {
        const del = await page.request.delete(`${API_BASE}/listings/${rowId}`, { headers: seedHeaders });
        if (!del.ok()) cleanupFailures.push(`listing delete ${del.status()}`);
      }
    } catch (err) {
      cleanupFailures.push(`listing cleanup threw: ${(err as Error).message}`);
    }
    try {
      const del = await page.request.delete(`${API_BASE}/items/${itemId}`, { headers: seedHeaders });
      if (!del.ok()) cleanupFailures.push(`item delete ${del.status()}`);
    } catch (err) {
      cleanupFailures.push(`item cleanup threw: ${(err as Error).message}`);
    }
    expect.soft(cleanupFailures, "seeded-fixture cleanup failed").toEqual([]);
  }
});

test("Accept-offers toggle rides the draft-save into the persisted listing row", async ({ page }) => {
  // Per-listing eBay Best Offer (beta request 1ad18a5b): toggle + floors from
  // the publish sheet must land in the row's marketplace_specific_fields.
  await installSessionStub(page);
  await page.goto("/home");
  const seedToken = (await page.evaluate(() => localStorage.getItem("portage_token")))!;
  const seedHeaders = { Authorization: `Bearer ${seedToken}` };
  const itemRes = await page.request.post(`${API_BASE}/items`, {
    headers: seedHeaders, data: { title: "E2E accept-offers item" },
  });
  expect(itemRes.ok(), `item seed failed: ${itemRes.status()}`).toBeTruthy();
  const itemId = (await itemRes.json()).id as string;
  let rowId: string | undefined;
  try {
    await page.goto(`/inventory/${itemId}`);
    await page.getByRole("button", { name: "List on Marketplace" }).click();
    await page.getByPlaceholder("0.00").fill("120");

    const offersToggle = page.getByText("Accept offers", { exact: true }).locator("xpath=..").locator("div").first();
    await offersToggle.click();
    await page.getByLabel("Minimum offer ($)").fill("70");
    await page.getByLabel("Auto-accept at ($)").fill("100");

    // Advertising intent persists on the draft the same way (applied at publish).
    const promoteToggle = page.getByText("Promote this listing", { exact: true }).locator("xpath=..").locator("div").first();
    await promoteToggle.click();
    await page.getByLabel("Ad rate (% of sale)").fill("5");

    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();

    const res = await page.request.get(`${API_BASE}/listings?itemId=${itemId}`, { headers: seedHeaders });
    expect(res.ok()).toBeTruthy();
    const row = ((await res.json()).listings as Array<{ id: string; marketplaceSpecificFields?: Record<string, unknown>; createdAt: string }>)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    expect(row, "no listing row found").toBeTruthy();
    rowId = row.id;
    expect(row.marketplaceSpecificFields).toMatchObject({
      bestOfferEnabled: true,
      minimumBestOfferPrice: 70,
      bestOfferAutoAcceptPrice: 100,
      ebayAdRate: 5,
    });
  } finally {
    const cleanupFailures: string[] = [];
    try {
      if (!rowId) {
        const res = await page.request.get(`${API_BASE}/listings?itemId=${itemId}`, { headers: seedHeaders });
        if (res.ok()) rowId = ((await res.json()).listings as Array<{ id: string }>)[0]?.id;
      }
      if (rowId) {
        const del = await page.request.delete(`${API_BASE}/listings/${rowId}`, { headers: seedHeaders });
        if (!del.ok()) cleanupFailures.push(`listing delete ${del.status()}`);
      }
    } catch (err) {
      cleanupFailures.push(`listing cleanup threw: ${(err as Error).message}`);
    }
    try {
      const del = await page.request.delete(`${API_BASE}/items/${itemId}`, { headers: seedHeaders });
      if (!del.ok()) cleanupFailures.push(`item delete ${del.status()}`);
    } catch (err) {
      cleanupFailures.push(`item cleanup threw: ${(err as Error).message}`);
    }
    expect.soft(cleanupFailures, "seeded-fixture cleanup failed").toEqual([]);
  }
});
