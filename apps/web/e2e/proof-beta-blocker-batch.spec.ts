import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { installSessionStub } from "./session-stub";

/**
 * Proof capture for the Phase-1 beta-blocker batch (6454017d / 25afd214 /
 * 307ffa75) on the REAL built bundle (ephemeral stack: dev-bypass identity,
 * throwaway DB, no marketplace creds). psql-seeded fixed ids, one item per
 * marketplace card so first() selectors are unambiguous (cards render
 * newest-first — the two-listing layout bit a prior run). The BO conflict
 * runs the REAL server 422 (credless heal no-ops → healed:false branch).
 */
const SHOT_DIR = path.join(process.cwd(), "test-results", "proof", "beta-blocker-batch");

const P1_ITEM = "00000000-0000-4000-8000-00000000bb01";
const P1_LISTING = "00000000-0000-4000-8000-00000000bb02";
const P2_ITEM = "00000000-0000-4000-8000-00000000bb03";
const P2_LISTING = "00000000-0000-4000-8000-00000000bb04";
const P3_ITEM = "00000000-0000-4000-8000-00000000bb05";
const P3_LISTING = "00000000-0000-4000-8000-00000000bb06";

const DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? "portage-e2e-db-1";
const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@portage.app";

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", DB_CONTAINER, "psql", "-U", "portage", "-d", "portage", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}
function sqlLit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
function cleanup() {
  for (const l of [P1_LISTING, P2_LISTING, P3_LISTING]) {
    psql(`DELETE FROM marketplace_sync_log WHERE listing_id = '${l}'`);
    psql(`DELETE FROM sync_jobs WHERE listing_id = '${l}'`);
    psql(`DELETE FROM listings WHERE id = '${l}'`);
  }
  for (const i of [P1_ITEM, P2_ITEM, P3_ITEM]) psql(`DELETE FROM items WHERE id = '${i}'`);
}

test.beforeAll(() => {
  const userId = psql(`SELECT id FROM users WHERE email = ${sqlLit(E2E_USER_EMAIL)} LIMIT 1`);
  expect(userId, `${E2E_USER_EMAIL} must exist (auth.setup provisions it)`).toBeTruthy();
  cleanup();
  psql(`INSERT INTO items (id, user_id, title, description, category, condition, quantity, price)
        VALUES ('${P1_ITEM}', '${userId}', 'E2E pickup proof', 'proof seed', 'electronics', 'good', 1, 100),
               ('${P2_ITEM}', '${userId}', 'E2E BO proof', 'proof seed', 'electronics', 'good', 1, 219),
               ('${P3_ITEM}', '${userId}', 'E2E cascade proof', 'proof seed', 'instruments', 'good', 1, 700)`);
  psql(`INSERT INTO listings (id, item_id, user_id, marketplace, marketplace_listing_id, status, price, currency, marketplace_specific_fields)
        VALUES ('${P1_LISTING}', '${P1_ITEM}', '${userId}', 'ebay', NULL, 'draft', 100, 'USD',
                '{"ebayShipping":{"method":"calculated","handlingDays":2}}'::jsonb),
               ('${P2_LISTING}', '${P2_ITEM}', '${userId}', 'ebay', '99000000002', 'active', 219, 'USD',
                '{"categoryId":"175669","bestOfferEnabled":true,"bestOfferAutoAcceptPrice":209,"minimumBestOfferPrice":199}'::jsonb),
               ('${P3_LISTING}', '${P3_ITEM}', '${userId}', 'reverb', NULL, 'draft', 700, 'USD', NULL)`);
});
test.afterAll(() => cleanup());

test.beforeEach(async ({ page }) => {
  await installSessionStub(page);
});

test("6454017d — pickup toggles on, survives save + reopen, persists to DB", async ({ page }) => {
  await page.goto(`/inventory/${P1_ITEM}`);
  await page.getByRole("button", { name: /edit shipping/i }).click();
  const pickupTrack = page.locator('label:has-text("Offer local pickup") > div').first();
  await expect(pickupTrack).toBeVisible();
  await pickupTrack.click();
  await page.getByRole("button", { name: /save shipping/i }).click();
  await expect(page.getByRole("button", { name: /edit shipping/i })).toBeVisible({ timeout: 15000 });

  // DB proof: the toggle rode the PATCH.
  expect(psql(`SELECT marketplace_specific_fields->'ebayShipping'->>'localPickup' FROM listings WHERE id = '${P1_LISTING}'`)).toBe("true");

  // Reopen: the stored value seeds the editor ON (the 6454017d bug dropped it).
  await page.getByRole("button", { name: /edit shipping/i }).click();
  await expect(pickupTrack).toHaveClass(/bg-forest-green/);
  await page.screenshot({ path: path.join(SHOT_DIR, "1-pickup-on-after-reopen.png"), fullPage: true });
});

test("25afd214 — real 422 opens guided fix with thresholds; nothing saved", async ({ page }) => {
  await page.goto(`/inventory/${P2_ITEM}`);
  await page.getByRole("button", { name: /edit price/i }).click();
  await page.getByLabel("Price", { exact: true }).fill("199");
  await page.getByRole("button", { name: /^save$/i }).click();

  // REAL server 422 (credless heal no-ops → healed:false): guided fields
  // visible with the effective thresholds, editor still open, error shown.
  await expect(page.getByLabel(/auto-accept price/i)).toHaveValue("209");
  await expect(page.getByLabel(/minimum offer price/i)).toHaveValue("199");
  await page.screenshot({ path: path.join(SHOT_DIR, "2-bo-guided-fix.png"), fullPage: true });

  // DB proof: the rejected edit saved nothing.
  expect(psql(`SELECT price FROM listings WHERE id = '${P2_LISTING}'`)).toBe("219");
});

test("307ffa75 — Reverb publish dead end opens the cascade; pick persists categoryUuid", async ({ page }) => {
  // Publish 422 + taxonomy intercepted at the boundary — the real path needs
  // a live Reverb PAT the e2e user doesn't have. Component = real bundle.
  await page.route(new RegExp(`/listings/${P3_LISTING}/publish$`), (route) =>
    route.fulfill({
      status: 422,
      json: { error: "No Reverb category could be resolved for this item.", code: "REVERB_CATEGORY_REQUIRED" },
    }));
  await page.route(/\/marketplace\/reverb\/product-types/, (route) =>
    route.fulfill({ json: { productTypes: [
      { uuid: "pt-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "pt-fx", listable: true },
      { uuid: "pt-amp", fullName: "Amps", name: "Amps", rootUuid: "pt-amp", listable: true },
    ] } }));
  await page.route(/\/marketplace\/reverb\/subcategories/, (route) =>
    route.fulfill({ json: { subcategories: [] } }));

  await page.goto(`/inventory/${P3_ITEM}`);
  await page.getByRole("button", { name: /publish to reverb/i }).click();
  await expect(page.getByText(/pick one/i)).toBeVisible();
  await expect(page.getByLabel(/product type/i)).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "3-reverb-cascade.png"), fullPage: true });

  // The cascade drives a REAL PATCH of categoryUuid on save.
  await page.getByLabel(/product type/i).selectOption("pt-fx");
  await page.getByRole("button", { name: /save & publish/i }).click();
  await expect
    .poll(() => psql(`SELECT marketplace_specific_fields->>'categoryUuid' FROM listings WHERE id = '${P3_LISTING}'`))
    .toBe("pt-fx");
  await page.screenshot({ path: path.join(SHOT_DIR, "4-cascade-saved-categoryuuid.png"), fullPage: true });
});
