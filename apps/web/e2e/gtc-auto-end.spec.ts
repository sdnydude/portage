import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "gtc");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

// GTC auto-end (Phase 4.3): the seller-profile toggle must persist through the
// PATCH round-trip and a full reload, and an active eBay listing's detail page
// must surface the upcoming GTC date ("Auto-ends" when opted in, "GTC renews"
// otherwise). Non-destructive: the toggle is restored to its original state.
test("GTC auto-end toggle persists across reload; detail page shows the GTC date", async ({ page, request }) => {
  await page.goto("/settings/seller-profile");
  const toggle = page.getByLabel(/eBay GTC/i);
  await expect(toggle).toBeVisible();
  const original = await toggle.isChecked();

  // Flip the toggle and wait for the PATCH to land — not just the click.
  const patchDone = page.waitForResponse(
    (r) => r.url().includes("/seller-profile") && r.request().method() === "PATCH" && r.ok(),
  );
  await toggle.click();
  await patchDone;
  await page.screenshot({ path: path.join(SHOT, "01-toggle-flipped.png"), fullPage: true });

  // Reload: the persisted value must come back from the server, not local state.
  await page.reload();
  const after = page.getByLabel(/eBay GTC/i);
  await expect(after).toBeVisible();
  expect(await after.isChecked()).toBe(!original);
  await page.screenshot({ path: path.join(SHOT, "02-toggle-persisted-after-reload.png"), fullPage: true });

  // Detail-page GTC date — only when the account has an active eBay listing
  // (the ephemeral CI stack seeds none; live runs have real data).
  const token = await page.evaluate(() => localStorage.getItem("portage_token"));
  const listingsRes = await request.get(`${API_BASE}/listings?status=active&marketplace=ebay&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listingsRes.ok()).toBeTruthy();
  const { listings } = await listingsRes.json();
  if (listings.length > 0 && listings[0].publishedAt) {
    await page.goto(`/listings/${listings[0].id}`);
    const expected = !original ? "Auto-ends" : "GTC renews";
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, "03-detail-gtc-date.png"), fullPage: true });
  }

  // Restore the original toggle state via the API (non-destructive contract).
  const restore = await request.patch(`${API_BASE}/seller-profile`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { gtcAutoEnd: original },
  });
  expect(restore.ok()).toBeTruthy();
});
