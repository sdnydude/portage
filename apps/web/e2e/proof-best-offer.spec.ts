import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Proof capture for the Best Offer fix (BO-5): price editor carries the
 * offer thresholds, a conflicting price is rejected 422 BEFORE saving with
 * the numbers visible, and a combined price+thresholds edit saves.
 *
 * Ephemeral stack only (dev-bypass identity, throwaway DB, no eBay creds —
 * the conflict-time GetItem heal no-ops, exactly the found:false branch).
 * Nothing here calls eBay.
 */
const SHOT_DIR = path.join(process.cwd(), "test-results", "proof", "best-offer");

const ITEM_ID = "00000000-0000-4000-8000-000000000b01";
const LISTING_ID = "00000000-0000-4000-8000-000000000b02";

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
  psql(`DELETE FROM marketplace_sync_log WHERE listing_id = '${LISTING_ID}'`);
  psql(`DELETE FROM sync_jobs WHERE listing_id = '${LISTING_ID}'`);
  psql(`DELETE FROM listings WHERE id = '${LISTING_ID}'`);
  psql(`DELETE FROM items WHERE id = '${ITEM_ID}'`);
}

test.beforeAll(() => {
  const userId = psql(`SELECT id FROM users WHERE email = ${sqlLit(E2E_USER_EMAIL)} LIMIT 1`);
  expect(userId, `${E2E_USER_EMAIL} must exist (auth.setup provisions it)`).toBeTruthy();
  cleanup();
  psql(`INSERT INTO items (id, user_id, title, description, category, condition, quantity, price)
        VALUES ('${ITEM_ID}', '${userId}', 'E2E Best Offer SSD', 'proof seed', 'electronics', 'good', 1, 219)`);
  psql(`INSERT INTO listings (id, item_id, user_id, marketplace, marketplace_listing_id, status, price, currency, marketplace_specific_fields)
        VALUES ('${LISTING_ID}', '${ITEM_ID}', '${userId}', 'ebay', '99000000001', 'active', 219, 'USD',
                '{"categoryId":"175669","bestOfferEnabled":true,"bestOfferAutoAcceptPrice":209,"minimumBestOfferPrice":199}'::jsonb)`);
});

test.afterAll(() => {
  cleanup();
});

test("price editor shows thresholds; conflict rejects 422 with the numbers; combined edit saves", async ({ page }) => {
  await page.goto(`/inventory/${ITEM_ID}`);

  await page.getByRole("button", { name: /edit price/i }).click();
  const accept = page.getByLabel(/auto-accept price/i);
  await expect(accept).toHaveValue("209");
  await expect(page.getByLabel(/minimum offer price/i)).toHaveValue("199");
  await page.screenshot({ path: path.join(SHOT_DIR, "1-bo-fields-prefilled.png"), fullPage: true });

  // Conflict: price at the stored minimum / below auto-accept → 422 before
  // any save; the error carries the actual numbers.
  await page.getByLabel("Price", { exact: true }).fill("199");
  await page.getByRole("button", { name: /^save$/i }).click();
  const err = page.getByText(/auto-accept.*\$209|\$209.*auto-accept/i);
  await expect(err).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "2-conflict-422-with-numbers.png"), fullPage: true });

  // DB proof: nothing was saved by the rejected edit.
  expect(psql(`SELECT price FROM listings WHERE id = '${LISTING_ID}'`)).toBe("219");

  // Combined edit: price + both thresholds fixed together → passes pre-flight
  // and saves (marketplace sync then fails on the credless ephemeral stack,
  // surfacing the soft warning — the local save is the proof target).
  await page.getByLabel("Price", { exact: true }).fill("199");
  await accept.fill("195");
  await page.getByLabel(/minimum offer price/i).fill("185");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("button", { name: /edit price/i })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.join(SHOT_DIR, "3-combined-edit-saved.png"), fullPage: true });

  // DB proof: price + healed thresholds persisted together.
  expect(psql(`SELECT price FROM listings WHERE id = '${LISTING_ID}'`)).toBe("199");
  const fields = psql(`SELECT marketplace_specific_fields->>'bestOfferAutoAcceptPrice' || '/' || (marketplace_specific_fields->>'minimumBestOfferPrice') FROM listings WHERE id = '${LISTING_ID}'`);
  expect(fields).toBe("195/185");
});
