import { test, expect } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

// Listing-hub Task 2: item detail renders a Marketplace Listings section with a
// ListingCard per listing, and the cross-list CTA replaces the primary CTA once
// a listing exists. Self-seeds an item + DB-only eBay draft via the API so the
// spec is deterministic on any stack (ephemeral CI db has no prod rows).
const SHOT = path.join(process.cwd(), "test-results", "proof", "listing-hub");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

test.beforeEach(async ({ page }) => {
  await installSessionStub(page);
});

async function seedItemWithDraft(page: import("@playwright/test").Page) {
  const token = (await page.evaluate(() => localStorage.getItem("portage_token")))!;
  const headers = { Authorization: `Bearer ${token}` };
  const itemRes = await page.request.post(`${API_BASE}/items`, {
    headers, data: { title: "E2E listing-hub item" },
  });
  expect(itemRes.ok(), `item seed failed: ${itemRes.status()}`).toBeTruthy();
  const item = await itemRes.json();
  try {
    // Draft mode — no marketplace call is made.
    const listingRes = await page.request.post(`${API_BASE}/listings`, {
      headers, data: { itemId: item.id, marketplace: "ebay", price: 1200 },
    });
    expect(listingRes.ok(), `listing seed failed: ${listingRes.status()}`).toBeTruthy();
    const listing = await listingRes.json();
    return { token, headers, itemId: item.id as string, listingId: listing.id as string };
  } catch (err) {
    // Roll back the half-seeded fixture — the caller never got the ids, so its
    // finally-cleanup can't run.
    await page.request.delete(`${API_BASE}/items/${item.id}`, { headers });
    throw err;
  }
}

async function cleanup(page: import("@playwright/test").Page, s: { headers: Record<string, string>; itemId: string; listingId: string }) {
  // Surface failures (expect.soft: recorded without masking the test's own
  // error) but always attempt both deletes.
  const listingDel = await page.request.delete(`${API_BASE}/listings/${s.listingId}`, { headers: s.headers });
  expect.soft(listingDel.ok(), `listing cleanup failed: ${listingDel.status()}`).toBeTruthy();
  const itemDel = await page.request.delete(`${API_BASE}/items/${s.itemId}`, { headers: s.headers });
  expect.soft(itemDel.ok(), `item cleanup failed: ${itemDel.status()}`).toBeTruthy();
}

test("item detail shows the Marketplace Listings section and survives reload", async ({ page }) => {
  // Token must exist in localStorage before seeding — load any page first.
  await page.goto("/home");
  const s = await seedItemWithDraft(page);
  try {
    await page.goto(`/inventory/${s.itemId}`);

    const heading = page.getByRole("heading", { name: "Marketplace Listings" });
    await expect(heading).toBeVisible();
    await expect(page.getByText("Draft").first()).toBeVisible();
    await expect(page.getByText("$1,200").first()).toBeVisible();

    // Cross-list demotion: the section replaces the primary CTA once a listing exists.
    await expect(page.getByRole("button", { name: /list on another marketplace/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^List on Marketplace$/ })).toHaveCount(0);

    // Reload — server data, not local state, renders the section.
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(page.getByText("$1,200").first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, "1-section.png"), fullPage: true });
  } finally {
    await cleanup(page, s);
  }
});

test("?listing= deep link scrolls the card into view", async ({ page }) => {
  await page.goto("/home");
  const s = await seedItemWithDraft(page);
  try {
    await page.goto(`/inventory/${s.itemId}?listing=${s.listingId}`);

    const card = page.locator(`#listing-${s.listingId}`);
    await expect(card).toBeVisible();
    // The one-shot scroll effect centers the card in the viewport.
    await expect(async () => {
      const box = await card.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box, "card must be laid out").toBeTruthy();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }).toPass({ timeout: 5_000 });
    await page.screenshot({ path: path.join(SHOT, "2-deeplink.png"), fullPage: false });
  } finally {
    await cleanup(page, s);
  }
});
