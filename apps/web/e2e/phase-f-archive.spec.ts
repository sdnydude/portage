import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "archive");
const LISTING_ID = "52f04cba-2979-4947-957d-b2af7108a57b"; // active eBay listing 307022338248

async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("archive an active listing -> ends it on eBay", async ({ page }) => {
  // Live: targets a hardcoded real active eBay listing on the demo account, absent
  // from the fresh ephemeral CI database. Opt in via E2E_EBAY_LIVE.
  test.skip(!process.env.E2E_EBAY_LIVE, "Requires a live eBay-connected account + seeded active listing; set E2E_EBAY_LIVE=1 to run");
  test.setTimeout(90_000);
  await login(page);

  // /listings/[id] is a resolver-redirect since listing-hub Task 4 — landing
  // here proves the redirect AND the hub's card actions in one pass.
  await page.goto(`/listings/${LISTING_ID}`);
  await page.waitForURL(`**/inventory/**?listing=${LISTING_ID}`, { timeout: 30_000 });
  await page.screenshot({ path: path.join(SHOT, "1-before-active.png"), fullPage: true });

  await page.getByRole("button", { name: "Archive Listing" }).click();
  // Confirm dialog -> the confirm action is "Archive".
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "PATCH" && /\/listings\/[^/]+$/.test(new URL(r.url()).pathname),
      { timeout: 60_000 },
    ),
    page.getByRole("button", { name: "Archive", exact: true }).click(),
  ]);
  const body = await resp.json().catch(() => ({}));
  console.log("ARCHIVE RESP:", JSON.stringify(body));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOT, "2-after-archive.png"), fullPage: true });
  expect(resp.ok()).toBeTruthy();
});
