import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "scanpub");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("scan -> eBay draft -> live publish (real)", async ({ page }) => {
  test.skip(!process.env.E2E_EBAY_LIVE, "Requires a live eBay-connected account + seeded active listing; set E2E_EBAY_LIVE=1 to run");
  test.setTimeout(180_000);
  let listingId: string | null = null;

  await login(page);
  const token = await page.evaluate(() => localStorage.getItem("portage_token"));

  await test.step("scan a new item and Save & List as eBay draft", async () => {
    await page.getByRole("button", { name: "Scan item" }).click();
    await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));
    await page.getByRole("button", { name: /Scan \d+ Photo/ }).click();

    const priceInput = page.getByLabel("Price (USD)");
    await expect(priceInput).toBeVisible({ timeout: 150_000 });
    await priceInput.fill("199.99");
    await page.getByLabel("List as eBay draft").check();
    await page.screenshot({ path: path.join(SHOT, "1-scan-review.png"), fullPage: true });

    await page.getByRole("button", { name: "Save & List" }).click();
    const confirm = page.getByRole("button", { name: "Save eBay Draft" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: path.join(SHOT, "2-confirm-sheet.png"), fullPage: true });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/listings"),
        { timeout: 60_000 },
      ),
      confirm.click(),
    ]);
    const body = await resp.json().catch(() => ({}));
    listingId = body?.id ?? null;
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOT, "3-draft-result.png"), fullPage: true });
  });

  await test.step("open the draft and publish it live", async () => {
    expect(listingId, "scan must have created a listing").toBeTruthy();
    await page.goto(`/listings/${listingId}`);
    const publishBtn = page.getByRole("button", { name: /Publish to eBay/i });
    await expect(publishBtn).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SHOT, "4-draft-detail.png"), fullPage: true });

    const [pubResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && /\/listings\/.+\/publish$/.test(new URL(r.url()).pathname),
        { timeout: 90_000 },
      ),
      publishBtn.click(),
    ]);
    const pub = await pubResp.json().catch(() => ({}));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SHOT, "5-after-publish.png"), fullPage: true });
    // Read the live eBay state back through the in-app verification route.
    if (listingId && token) {
      const v = await page.request.get(`${API_BASE}/listings/${listingId}/ebay-offer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("PUBLISH RESP:", JSON.stringify(pub));
      console.log("READBACK:", v.ok() ? await v.text() : `HTTP ${v.status()}`);
    }
  });
});
