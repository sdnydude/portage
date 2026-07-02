import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "archivelive");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";
const ITEM_URL = "/inventory/9b913b46-3c2e-459a-ae95-f1bb73316277"; // known-good eBay item

async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}
async function readOffer(page: Page, id: string, token: string) {
  const r = await page.request.get(`${API_BASE}/listings/${id}/ebay-offer`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok() ? r.json() : { _http: r.status() };
}

test("publish a live listing, then Archive it -> verify it ended on eBay", async ({ page }) => {
  test.skip(!process.env.E2E_EBAY_LIVE, "Requires a live eBay-connected account + seeded active listing; set E2E_EBAY_LIVE=1 to run");
  test.setTimeout(150_000);
  const token = (await (async () => { await login(page); return page.evaluate(() => localStorage.getItem("portage_token")); })())!;
  let listingId: string | null = null;

  await test.step("publish-now -> live listing (id starts with 3)", async () => {
    await page.goto(ITEM_URL);
    await page.getByRole("button", { name: "List on Marketplace" }).click();
    await expect(page.getByText("Create Listing")).toBeVisible();
    const price = page.getByPlaceholder("0.00");
    if ((await price.inputValue()) === "") await price.fill("89.99");
    await page.locator("label", { hasText: "Publish immediately" }).locator("div").first().click();
    await page.getByRole("button", { name: "Review Terms" }).click();
    // The terms sheet gates "Accept & Publish" on the agree checkbox (first checkbox).
    await page.getByRole("checkbox").first().click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/listings"), { timeout: 90_000 }),
      page.getByRole("button", { name: "Accept & Publish" }).click(),
    ]);
    const body = await resp.json().catch(() => ({}));
    listingId = body?.id ?? null;
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOT, "1-published.png"), fullPage: true });

    expect(listingId, "publish must create a listing").toBeTruthy();
    const v = await readOffer(page, listingId!, token);
    console.log("AFTER PUBLISH:", JSON.stringify(v));
    expect(v.status, "offer should be PUBLISHED (live)").toBe("PUBLISHED");
    expect(String(v.listingId).startsWith("3"), `listingId ${v.listingId} should be live (starts with 3)`).toBeTruthy();
  });

  await test.step("Archive the live listing -> ends on eBay (offer UNPUBLISHED)", async () => {
    await page.goto(`/listings/${listingId}`);
    await page.getByRole("button", { name: "Archive Listing" }).click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "PATCH" && /\/listings\/[^/]+$/.test(new URL(r.url()).pathname), { timeout: 60_000 }),
      page.getByRole("button", { name: "Archive", exact: true }).click(),
    ]);
    expect(resp.ok(), "archive PATCH should succeed").toBeTruthy();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOT, "2-archived.png"), fullPage: true });

    const v = await readOffer(page, listingId!, token);
    console.log("AFTER ARCHIVE:", JSON.stringify(v));
    expect(v.status, "offer should be UNPUBLISHED (listing ended)").toBe("UNPUBLISHED");
  });
});
