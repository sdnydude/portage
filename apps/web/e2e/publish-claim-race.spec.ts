import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// Publish-claim race (2026-08-26): the terms sheet's Accept button must be a
// single-shot. Runs the REAL app against the rebuilt container; the network
// boundary is stubbed only to (a) hold the POST open so the busy state is
// observable and (b) answer 409 PUBLISH_IN_PROGRESS without creating a real
// eBay listing. Every tap still goes through the real CreateListingSheet.
// The server side is proven separately (proof/2026-08-26-publish-claim-race).
const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("double-tap on Accept & Publish sends one POST, shows Publishing…, renders the 409 as an in-progress notice", async ({ page }) => {
  test.skip(!process.env.E2E_EBAY_LIVE, "Requires a connected-marketplace publish flow; set E2E_EBAY_LIVE=1 to run");

  // Prod API is CF-fronted: the mount-time session exchange cannot carry a CF
  // assertion from Playwright, so answer it with the pre-minted token instead
  // of letting it log the page out. Every other request reaches the real API.
  await page.route("**/auth/session", async (route) => {
    const state = JSON.parse(require("node:fs").readFileSync(path.join(__dirname, ".auth", "user.json"), "utf8"));
    const ls = Object.fromEntries(state.origins[0].localStorage.map((e: { name: string; value: string }) => [e.name, e.value]));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: ls.portage_token, user: JSON.parse(ls.portage_user) }) });
  });

  let posts = 0;
  await page.route("**/listings", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    await new Promise((r) => setTimeout(r, 2500)); // hold the request open
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "This listing is already being published — wait for that result.", code: "PUBLISH_IN_PROGRESS" }),
    });
  });

  await login(page);
  // Seed a fresh item: one that already has a listing hides the primary CTA.
  const token = (await page.evaluate(() => localStorage.getItem("portage_token")))!;
  const itemRes = await page.request.post(`${API_BASE}/items`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "E2E publish-claim proof item", price: 42 },
  });
  expect(itemRes.ok(), `item seed failed: ${itemRes.status()}`).toBeTruthy();
  const itemId = (await itemRes.json()).id as string;
  await page.goto(`/inventory/${itemId}`);

  await page.getByRole("button", { name: "List on Marketplace" }).click();
  // Publish-now may already be on from the seller profile default.
  const publishToggle = page.locator("label", { hasText: "Publish immediately" }).locator("div").first();
  if (!(await page.getByRole("button", { name: /^(Publish|Review Terms)$/ }).isVisible())) await publishToggle.click();

  // Two entry points into handleCreate: the terms sheet's Accept (when terms
  // are not suppressed) or the direct Publish button (7-day suppression on).
  // Both must be single-shot; the seller's current state decides which runs.
  const primary = page.getByRole("button", { name: /^(Publish|Review Terms)$/ });
  const viaTerms = (await primary.textContent())?.trim() === "Review Terms";
  let tapTarget = primary;
  if (viaTerms) {
    await primary.click();
    await page.getByRole("checkbox").first().click();
    tapTarget = page.getByRole("button", { name: "Accept & Publish" });
  }
  await tapTarget.click();
  await tapTarget.click({ force: true, timeout: 1000 }).catch(() => { /* already disabled — fine */ });

  const busy = page.getByRole("button", { name: viaTerms ? "Publishing…" : "Creating..." });
  await expect(busy).toBeVisible();
  await expect(busy).toBeDisabled();
  await page.screenshot({ path: path.join(SHOT_DIR, "publish-claim-busy.png"), fullPage: true });

  await expect(page.getByText(/already being published/i)).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(SHOT_DIR, "publish-claim-409.png"), fullPage: true });

  expect(posts).toBe(1);
});
