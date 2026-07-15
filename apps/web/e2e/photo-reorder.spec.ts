import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");
const API = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

// 1×1 PNG; the #fragment is ignored by the renderer but kept in src, giving
// each photo a distinguishable DOM identity without needing R2.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SEED = [
  { url: `${PNG}#one`, key: "e2e-r1" },
  { url: `${PNG}#two`, key: "e2e-r2" },
  { url: `${PNG}#three`, key: "e2e-r3" },
];

// Session from auth.setup.ts storageState — no per-test login (auth limiter).
async function token(page: Page): Promise<string> {
  await page.goto("/home");
  await page.waitForURL("**/home");
  const t = await page.evaluate(() => localStorage.getItem("portage_token"));
  expect(t).toBeTruthy();
  return t!;
}

async function firstItemId(page: Page): Promise<string> {
  await page.goto("/inventory");
  const link = page.locator('a[href^="/inventory/"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  return href!.split("/").pop()!;
}

async function getPhotos(page: Page, itemId: string, authToken: string): Promise<Array<{ key?: string; isPrimary?: boolean }>> {
  const res = await page.request.get(`${API}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return (body.item ?? body).photos ?? [];
}

async function setPhotos(page: Page, itemId: string, authToken: string, photos: unknown) {
  const res = await page.request.patch(`${API}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
    data: { photos },
  });
  expect(res.ok()).toBe(true);
}

/** Long-press drag from one sheet tile to another (touch-parity mouse path). */
async function longPressDrag(page: Page, from: ReturnType<Page["locator"]>, to: ReturnType<Page["locator"]>) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650); // > 500ms long-press activation
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

test.describe("photo reorder + delete (F1+F2)", () => {
  test("drag in the manage sheet reorders, COVER follows, order survives reload", async ({ page }) => {
    const authToken = await token(page);
    const itemId = await firstItemId(page);
    const original = await getPhotos(page, itemId, authToken);
    try {
      await setPhotos(page, itemId, authToken, SEED);
      await page.goto(`/inventory/${itemId}`);
      await expect(page.getByText(/Photos · 3/)).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, "pr-1-before.png"), fullPage: true });

      // Open the manage sheet from the strip header.
      await page.getByRole("button", { name: "Manage photos" }).click();
      const sheetTiles = page.getByTestId("photo-manage-sheet").locator("[data-photo-drag-index]");
      await expect(sheetTiles).toHaveCount(3);
      // The sheet slides up (0.35s) — boundingBox coords measured mid-animation
      // land a full viewport below and the drag grabs nothing.
      await page.waitForFunction(() => {
        const sh = document.querySelector('[data-testid="photo-manage-sheet"]');
        return sh !== null && sh.getBoundingClientRect().y === 0;
      });
      await page.screenshot({ path: path.join(SHOT_DIR, "pr-2-sheet.png") });

      // Drag photo 1 onto photo 3 → order becomes [two, three, one].
      await longPressDrag(page, sheetTiles.nth(0), sheetTiles.nth(2));
      await page.screenshot({ path: path.join(SHOT_DIR, "pr-3-after-drag.png") });
      await page.getByRole("button", { name: "Done" }).click();

      // One coalesced PATCH landed the order — verify server-side.
      await expect
        .poll(async () => (await getPhotos(page, itemId, authToken)).map((p) => p.key))
        .toEqual(["e2e-r2", "e2e-r3", "e2e-r1"]);
      const after = await getPhotos(page, itemId, authToken);
      expect(after[0].isPrimary).toBe(true);
      expect(after.filter((p) => p.isPrimary)).toHaveLength(1);

      // Survives reload; COVER sits on the new first photo.
      await page.reload();
      await expect(page.getByText(/Photos · 3/)).toBeVisible();
      const firstThumb = page.getByRole("button", { name: "Edit photo 1" });
      await expect(firstThumb.locator("img")).toHaveAttribute("src", /#two/);
      await expect(firstThumb.getByText("COVER")).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, "pr-4-persisted.png"), fullPage: true });
    } finally {
      await setPhotos(page, itemId, authToken, original);
    }
  });

  test("delete in the manage sheet removes the photo and persists", async ({ page }) => {
    const authToken = await token(page);
    const itemId = await firstItemId(page);
    const original = await getPhotos(page, itemId, authToken);
    try {
      await setPhotos(page, itemId, authToken, SEED);
      await page.goto(`/inventory/${itemId}`);
      await expect(page.getByText(/Photos · 3/)).toBeVisible();

      await page.getByRole("button", { name: "Manage photos" }).click();
      await page.getByRole("button", { name: "Delete photo 2" }).click();
      await page.getByRole("button", { name: "Done" }).click();

      await expect
        .poll(async () => (await getPhotos(page, itemId, authToken)).map((p) => p.key))
        .toEqual(["e2e-r1", "e2e-r3"]);
      await expect(page.getByText(/Photos · 2/)).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, "pr-5-deleted.png"), fullPage: true });
    } finally {
      await setPhotos(page, itemId, authToken, original);
    }
  });
});
