import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

/**
 * F-GATE — proves an eBay-draft publish works from BOTH publish panels and that the
 * MPN item-specific lands on the eBay offer (PR #132's merge-gate). Each path drives
 * the real UI on the container, then reads the live eBay offer back through the in-app
 * GET /listings/:id/ebay-offer route (a standalone tsx script deadlocks on token
 * refresh, so the read must run in-process).
 *
 * LIVE: this creates real, unpublished eBay draft offers on the demo account's eBay
 * account. Orphan cleanup is F-ORPHAN (next task) — these drafts are left behind.
 *
 * The scan path runs a real AI vision scan, so it is inherently slower and less
 * deterministic than the item-detail path; the fixture is the demo's own iPhone photo
 * (a high-confidence identification) and the assertions tolerate eBay's "Does Not
 * Apply" MPN sentinel.
 */

const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";
const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// Session comes from auth.setup.ts via storageState — no per-test login.
async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

// Read the live eBay verification for a listing through the in-app route, using the
// session token already in localStorage (the route is requireAuth + ownership-scoped).
async function readEbayOffer(page: Page, listingId: string) {
  const token = await page.evaluate(() => localStorage.getItem("portage_token"));
  const res = await page.request.get(`${API_BASE}/listings/${listingId}/ebay-offer`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `ebay-offer read failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

test.describe("F-GATE: eBay-draft publish + MPN verification", () => {
  test("item-detail panel: Save as eBay draft creates an unpublished offer with MPN", async ({ page }) => {
    await login(page);

    // A branded item already in the demo inventory (has an eBay category + selling
    // setup, so the offer can be created). Pick the first listable item.
    await page.goto("/inventory");
    const firstItem = page.locator('a[href^="/inventory/"]').first();
    await expect(firstItem).toBeVisible();
    await firstItem.click();

    await page.getByRole("button", { name: "List on Marketplace" }).click();

    // Default sheet state: marketplace=eBay, Publish immediately OFF → the eBay-draft
    // toggle is visible. Its onClick lives on the toggle div inside the label.
    const draftToggle = page.locator("label", { hasText: "Save as eBay draft" }).locator("div").first();
    await expect(draftToggle).toBeVisible();
    await draftToggle.click();

    // Ensure a valid price (prefill may be empty).
    const priceInput = page.getByPlaceholder("0.00");
    await priceInput.fill("123.45");

    await page.screenshot({ path: path.join(SHOT_DIR, "fgate-1-item-detail-sheet.png"), fullPage: true });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/listings"),
        { timeout: 60_000 },
      ),
      page.getByRole("button", { name: "Save eBay Draft" }).click(),
    ]);
    expect(resp.ok(), `POST /listings failed: ${resp.status()} ${await resp.text()}`).toBeTruthy();
    const created = await resp.json();
    expect(created.id).toBeTruthy();

    const v = await readEbayOffer(page, created.id);
    expect(v.found).toBe(true);
    expect(v.offerId).toBeTruthy();
    // MPN landed on the offer (a real part number OR eBay's "Does Not Apply" sentinel
    // — both prove the product.mpn → aspects.MPN mirror from PR #132 works; blank = bug).
    expect(v.aspects?.MPN?.length ?? 0).toBeGreaterThan(0);
  });

  test("scan panel: Save & List as eBay draft creates an unpublished offer with MPN", async ({ page }) => {
    test.setTimeout(150_000); // a real AI vision scan dominates this path

    await login(page);
    await page.getByRole("button", { name: "Scan item" }).click();

    // Upload the fixture into the (hidden) scan file input, then run the scan.
    await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));
    await page.getByRole("button", { name: /Scan \d+ Photo/ }).click();

    // Review step appears once the AI scan resolves (the price field is review-only).
    const priceInput = page.getByLabel("Price (USD)");
    await expect(priceInput).toBeVisible({ timeout: 120_000 });
    await priceInput.fill("123.45");

    await page.getByLabel("List as eBay draft").check();
    await page.screenshot({ path: path.join(SHOT_DIR, "fgate-2-scan-review.png"), fullPage: true });

    const saveAndList = page.getByRole("button", { name: "Save & List" });
    await expect(saveAndList, "Save & List is gated — required eBay specifics not filled by the AI scan").toBeEnabled();
    await saveAndList.click();

    // F1: scan now creates the item then opens the unified confirm sheet (seeded
    // as an eBay draft). Confirm there to actually create the listing.
    const confirm = page.getByRole("button", { name: "Save eBay Draft" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, "fgate-3-scan-confirm-sheet.png"), fullPage: true });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/listings"),
        { timeout: 60_000 },
      ),
      confirm.click(),
    ]);
    expect(resp.ok(), `POST /listings failed: ${resp.status()} ${await resp.text()}`).toBeTruthy();
    const created = await resp.json();
    expect(created.id).toBeTruthy();

    const v = await readEbayOffer(page, created.id);
    expect(v.found).toBe(true);
    expect(v.offerId).toBeTruthy();
    expect(v.aspects?.MPN?.length ?? 0).toBeGreaterThan(0);
  });
});
