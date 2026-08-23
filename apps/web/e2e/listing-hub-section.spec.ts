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
  // error) but always attempt both deletes. 404 = already cleaned by the test
  // body itself — that's success, not a leak.
  const listingDel = await page.request.delete(`${API_BASE}/listings/${s.listingId}`, { headers: s.headers });
  expect.soft(listingDel.ok() || listingDel.status() === 404, `listing cleanup failed: ${listingDel.status()}`).toBeTruthy();
  const itemDel = await page.request.delete(`${API_BASE}/items/${s.itemId}`, { headers: s.headers });
  expect.soft(itemDel.ok() || itemDel.status() === 404, `item cleanup failed: ${itemDel.status()}`).toBeTruthy();
}

test("item detail shows the Marketplace Listings section and survives reload", async ({ page }) => {
  // Token must exist in localStorage before seeding — load any page first.
  await page.goto("/home");
  const s = await seedItemWithDraft(page);
  try {
    await page.goto(`/inventory/${s.itemId}`);

    const heading = page.getByRole("heading", { name: "Marketplace Listings" });
    await expect(heading).toBeVisible();
    // exact: the item-status <select> now carries a hidden "Draft (listing)" option (Housekeeping-1).
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
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

test("preview page captures and downloads a real PNG of the share card", async ({ page }) => {
  // Force the desktop download fallback — headless share sheets are flaky.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined });
  });
  await page.goto("/home");
  const s = await seedItemWithDraft(page);
  try {
    await page.goto(`/inventory/${s.itemId}/preview`);
    await expect(page.getByText("Sold with Portage")).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      page.getByRole("button", { name: "Share" }).click(),
    ]);
    const path = await download.path();
    const { statSync } = await import("node:fs");
    // A tainted/failed capture yields no blob at all; a real card PNG is >1KB.
    expect(statSync(path!).size).toBeGreaterThan(1024);
    await page.screenshot({ path: "test-results/proof/listing-hub/7-preview-page.png", fullPage: true });
  } finally {
    await cleanup(page, s);
  }
});

test("card actions: price edit persists and delete removes the card", async ({ page }) => {
  await page.goto("/home");
  const s = await seedItemWithDraft(page);
  try {
    await page.goto(`/inventory/${s.itemId}`);
    const card = page.locator(`#listing-${s.listingId}`);
    await expect(card).toBeVisible();

    // Price edit through the card → PATCH persists (reload re-asserts).
    await card.getByRole("button", { name: "Edit price" }).click();
    await card.getByLabel("Price").fill("1150");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("$1,150")).toBeVisible();
    await page.reload();
    await expect(page.locator(`#listing-${s.listingId}`).getByText("$1,150")).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, "3-price-edited.png"), fullPage: true });

    // Delete the draft through the card's confirm sheet → card leaves the DOM.
    await page.locator(`#listing-${s.listingId}`).getByRole("button", { name: "Delete Listing" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.locator(`#listing-${s.listingId}`)).toHaveCount(0, { timeout: 10_000 });
    await page.screenshot({ path: path.join(SHOT, "4-deleted.png"), fullPage: true });
  } finally {
    await cleanup(page, s); // deletes are idempotent server-side; soft-reported
  }
});
