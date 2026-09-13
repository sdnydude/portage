import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { installSessionStub } from "./session-stub";

/**
 * Rescan-from-inventory proof (2026-09-13). Runs against the isolated e2e
 * stack. The vision call is stubbed at the network boundary (no paid Gemini
 * call, deterministic candidate); the PATCH that Apply sends is real. The spec
 * owns a sentinel item (created in beforeAll, deleted in afterAll) so the
 * shared "E2E Seed Item" is never renamed — a retry or a later spec would
 * otherwise not find it. Screenshots land under test-results/proof/rescan/.
 */
const SHOT = path.join(process.cwd(), "test-results", "proof", "rescan");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";
const PHOTO = { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", key: "e2e-rescan-photo" };

let api: APIRequestContext;
let authHeaders: Record<string, string>;
let itemId: string;

async function shot(page: Page, name: string) {
  await page
    .waitForFunction(() => Array.from(document.images).every((i) => i.complete), undefined, { timeout: 4000 })
    .catch(() => {});
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
}

test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  // Reuse the auth.setup token (same reasoning as workbench.spec: no extra exchange).
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "user.json"), "utf8")) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  const token = state.origins.flatMap((o) => o.localStorage).find((e) => e.name === "portage_token")?.value;
  expect(token, "auth.setup storage state has no portage_token").toBeTruthy();
  authHeaders = { Authorization: `Bearer ${token!}` };
  const res = await api.post(`${API_BASE}/items`, {
    headers: authHeaders,
    data: { title: "E2E Rescan Sentinel", condition: "good", brand: "SeedBrand", photos: [PHOTO] },
  });
  expect(res.ok(), `sentinel create failed: ${res.status()}`).toBeTruthy();
  itemId = (await res.json()).id;
});

test.afterAll(async () => {
  if (itemId) await api.delete(`${API_BASE}/items/${itemId}`, { headers: authHeaders });
});

test.beforeEach(async ({ page }) => {
  await installSessionStub(page);
});

test("Rescan opens the diff sheet from a stubbed scan, Apply writes only the checked fields", async ({ page }) => {
  // POST /scan/refine answers 201 (apps/api/src/routes/scan.ts); the stub mirrors it.
  await page.route("**/scan/refine", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        identification: { name: "E2E Rescan Sentinel Pro" },
        detailed: {
          candidates: [{
            name: "E2E Rescan Sentinel Pro", description: "Overview\nA seeded test item.", category: "electronics",
            condition: "good", conditionNotes: "Light wear on the corners.", brand: "SeedBrand", model: "SB-100",
            features: ["Feature A"], aspects: { Color: ["Black"] },
            estimatedValueLow: 10, estimatedValueHigh: 20, confidence: 0.9,
          }],
          reasoning: [],
          provenance: { identification: { provider: "stub", model: "e2e" } },
        },
      }),
    }),
  );

  await page.goto(`/inventory/${itemId}`);
  await expect(page.getByRole("heading", { name: "E2E Rescan Sentinel" })).toBeVisible();

  await page.getByRole("button", { name: "Rescan" }).click();
  const dialog = page.getByRole("dialog", { name: "Rescan results" });
  await expect(dialog).toBeVisible();
  // Brand already set on the sentinel → no row; Model empty → pre-checked; Title set → unchecked.
  await expect(dialog.getByRole("checkbox", { name: "Model" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Title" })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Brand" })).toHaveCount(0);
  await shot(page, "rescan-sheet.png");

  await dialog.getByRole("checkbox", { name: "Select all" }).click();
  await dialog.getByRole("button", { name: /^Apply \d+ changes?$/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "E2E Rescan Sentinel Pro" })).toBeVisible();
  await shot(page, "rescan-applied.png");

  // DB truth via the API: only the checked fields moved, provenance stamped.
  const res = await api.get(`${API_BASE}/items/${itemId}`, { headers: authHeaders });
  expect(res.ok(), `item read-back failed: ${res.status()}`).toBeTruthy();
  const item = await res.json();
  expect(item.title).toBe("E2E Rescan Sentinel Pro");
  expect(item.model).toBe("SB-100");
  expect(item.brand).toBe("SeedBrand");
  expect(item.aspects).toEqual({ Color: ["Black"] });
  expect(item.marketplaceData?.scan?.provenance?.identification?.model).toBe("e2e");
});
