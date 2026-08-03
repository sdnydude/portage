import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * P3 sync truth surface (marketplace sync refactor): per-listing sync badge +
 * failed-state retry on the item hub, and the /settings/sync-log screen.
 *
 * Deterministic + marketplace-safe: a FAILED sync_jobs row and a failure
 * marketplace_sync_log row are seeded straight into the DB for a seeded
 * item/listing pair (the worker never touches terminal 'failed' jobs, and the
 * fake marketplaceListingId belongs to no real listing), then cleaned up.
 * Nothing here calls eBay or Reverb.
 */

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

const ITEM_ID = "00000000-0000-4000-8000-000000000e21";
const LISTING_ID = "00000000-0000-4000-8000-000000000e22";
const JOB_ID = "00000000-0000-4000-8000-000000000e23";
const LOG_ID = "00000000-0000-4000-8000-000000000e24";
const SEED_MESSAGE = "Reverb 422: shipping required (e2e seed)";

// This spec runs against the EPHEMERAL stack (docker-compose.e2e.yml —
// project portage-e2e, dev-bypass identity e2e@portage.app), never the live
// stack: the seed writes rows directly into the stack's throwaway DB.
const DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? "portage-e2e-db-1";
const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@portage.app";

function psql(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U portage -d portage -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf8" },
  ).trim();
}

function cleanup() {
  psql(`DELETE FROM sync_jobs WHERE listing_id = '${LISTING_ID}'`);
  psql(`DELETE FROM marketplace_sync_log WHERE listing_id = '${LISTING_ID}'`);
  psql(`DELETE FROM listings WHERE id = '${LISTING_ID}'`);
  psql(`DELETE FROM items WHERE id = '${ITEM_ID}'`);
}

test.beforeAll(() => {
  const userId = psql(`SELECT id FROM users WHERE email = '${E2E_USER_EMAIL}' LIMIT 1`);
  expect(userId, `${E2E_USER_EMAIL} must exist (auth.setup's session exchange provisions it)`).toBeTruthy();
  cleanup(); // idempotent re-runs
  psql(`INSERT INTO items (id, user_id, title, description, category, condition, quantity)
        VALUES ('${ITEM_ID}', '${userId}', 'E2E Sync Surface Guitar', 'e2e seed', 'guitars', 'good', 1)`);
  psql(`INSERT INTO listings (id, item_id, user_id, marketplace, marketplace_listing_id, status, price, currency)
        VALUES ('${LISTING_ID}', '${ITEM_ID}', '${userId}', 'reverb', '99000001', 'active', 1234, 'USD')`);
  psql(`INSERT INTO sync_jobs (id, user_id, item_id, listing_id, marketplace, trigger, status, attempts, last_error, next_run_at)
        VALUES ('${JOB_ID}', '${userId}', '${ITEM_ID}', '${LISTING_ID}', 'reverb', 'item_edit', 'failed', 5, '${SEED_MESSAGE}', now())`);
  psql(`INSERT INTO marketplace_sync_log (id, user_id, item_id, listing_id, marketplace, trigger, status, message, errors)
        VALUES ('${LOG_ID}', '${userId}', '${ITEM_ID}', '${LISTING_ID}', 'reverb', 'item_edit', 'failure', '${SEED_MESSAGE}', jsonb_build_array(jsonb_build_object('field', 'shipping')))`);
});

test.afterAll(() => {
  cleanup();
});

async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

test("item hub shows the failed sync badge and retry flips it to pending", async ({ page }) => {
  await login(page);
  await page.goto(`/inventory/${ITEM_ID}`);

  const badge = page.getByTestId(`sync-badge-${LISTING_ID}`);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/sync failed/i);
  await expect(page.getByText(SEED_MESSAGE)).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "sync-1-failed-badge.png"), fullPage: true });

  // Retry re-enqueues (a pending job for a fake listing id — the worker will
  // fail it again later, which is itself the truth surface working) and the
  // badge flips optimistically to Syncing….
  await page.getByRole("button", { name: /retry sync/i }).click();
  await expect(badge).toHaveText(/syncing/i);
  await page.screenshot({ path: path.join(SHOT_DIR, "sync-2-retry-pending.png"), fullPage: true });
});

test("settings sync log lists the failure with expandable details and survives reload", async ({ page }) => {
  await login(page);
  await page.goto("/settings/sync-log");

  await expect(page.getByRole("heading", { name: /marketplace sync log/i })).toBeVisible();
  await expect(page.getByText(SEED_MESSAGE).first()).toBeVisible();

  // Expand the structured errors payload.
  await page.getByRole("button", { name: /show details/i }).first().click();
  await expect(page.getByText(/"field": "shipping"/).first()).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "sync-3-log-screen.png"), fullPage: true });

  // Reload → server truth, not local state.
  await page.reload();
  await expect(page.getByText(SEED_MESSAGE).first()).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "sync-4-log-after-reload.png"), fullPage: true });
});
