import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

/**
 * Scan provenance proof (2026-09-05). LIVE vision call: the ephemeral e2e API
 * must carry a real GEMINI_API_KEY + VISION_PROVIDERS (compose override), and
 * R2_PUBLIC_URL so an existing public photo URL passes the refine schema.
 * Only the /images upload is stubbed (returns that existing photo URL); the
 * /scan/refine call, the model, and the /items save are real. Never in CI.
 *   E2E_SCAN_LIVE=1            — run it
 *   E2E_SCAN_PHOTO_URL=<url>   — an existing photo on R2_PUBLIC_URL
 */
test.skip(!process.env.E2E_SCAN_LIVE, "live vision call — set E2E_SCAN_LIVE=1 against a stack with a real vision key");

// Defaults target the ephemeral stack (docker-compose.e2e.yml); E2E_API_URL overrides.
const API_BASE = process.env.E2E_API_URL ?? "http://10.0.0.251:8998";
const PHOTO_URL = process.env.E2E_SCAN_PHOTO_URL ?? "";
// Position 1 of the chain the stack was brought up with (approved 2026-09-05).
const EXPECT_MODEL = process.env.E2E_SCAN_EXPECT_MODEL ?? "gemini-3.5-flash-lite";
const SHOT = path.join(process.cwd(), "test-results", "proof", "scan-provenance");

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
}

function authHeader(page: Page) {
  const token = page.context().storageState().then((s) =>
    s.origins.flatMap((o) => o.localStorage).find((e) => e.name === "portage_token")?.value,
  );
  return token.then((t) => ({ Authorization: `Bearer ${t}` }));
}

// Never leave the fixture row behind if this runs against a non-ephemeral DB.
let createdItemId = "";
test.afterEach(async ({ page, request }) => {
  if (!createdItemId) return;
  await request.delete(`${API_BASE}/items/${createdItemId}`, { headers: await authHeader(page) });
  createdItemId = "";
});

test("real scan → review → Save persists which model answered under marketplaceData.scan.provenance", async ({ page, request }) => {
  test.setTimeout(180_000);
  expect(PHOTO_URL, "E2E_SCAN_PHOTO_URL").toBeTruthy();
  // Against the prod-mode stack there is no CF edge: answer the app's mount-time
  // session exchange from storage state (no-op on the dev-bypass e2e stack).
  await installSessionStub(page);

  await page.route(/\/images$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ image: { url: PHOTO_URL, key: "proof/scan-provenance.jpg", width: 1024, height: 1024 } }),
    });
  });

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));

  const refine = page.waitForResponse((r) => r.url().endsWith("/scan/refine") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Scan 1 Photo/ }).click();
  const refineBody = await (await refine).json();
  expect(refineBody.detailed.provenance.identification.provider).toBe("gemini");

  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Price (USD)").fill("75");
  // Save stays disabled until the eBay category resolves (Taxonomy API, real).
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await shot(page, "01-review-after-real-scan.png");

  const create = page.waitForResponse((r) => r.url().endsWith("/items") && r.request().method() === "POST");
  await save.click();
  const item = await (await create).json();
  createdItemId = item.id;

  const saved = await (await request.get(`${API_BASE}/items/${item.id}`, { headers: await authHeader(page) })).json();
  const provenance = saved.marketplaceData?.scan?.provenance;
  expect(provenance).toEqual(refineBody.detailed.provenance);
  expect(provenance.identification.model).toBe(EXPECT_MODEL);

  await page.goto(`/inventory/${item.id}`);
  await expect(page.getByText(saved.title).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "02-item-saved.png");

  // Edit page: the description / condition-notes boxes auto-grow to the AI text.
  await page.goto(`/inventory/${item.id}/edit`);
  // First textarea in DOM order is the (hidden) Porter dock; the edit form's Description is next.
  await expect(page.locator('textarea:not([aria-label="Ask Porter"])').first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "03-item-edit-autogrow.png");
});
