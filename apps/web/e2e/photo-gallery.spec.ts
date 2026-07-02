import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// The session comes from auth.setup.ts via storageState — no per-test login
// (the API auth limiter is 10-in-15min and a 7-test suite was exhausting it).
async function login(page: Page) {
  await page.goto("/home");
  await page.waitForURL("**/home");
}

/** Open the first inventory item that has at least one photo (gallery strip rendered). */
async function openItemWithPhotos(page: Page) {
  await page.goto("/inventory");
  const itemLinks = page.locator('a[href^="/inventory/"]');
  await expect(itemLinks.first()).toBeVisible();
  const hrefs = (await itemLinks.evaluateAll((els) =>
    els.map((el) => el.getAttribute("href"))
  )).filter((h): h is string => !!h);
  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of hrefs.slice(0, 8)) {
    await page.goto(href);
    // The strip header renders even with zero photos — only an actual thumb
    // proves the item has photos.
    const firstThumb = page.getByRole("button", { name: "Edit photo 1" });
    try {
      await firstThumb.waitFor({ state: "visible", timeout: 4000 });
      return; // this item has photos
    } catch {
      // no photos on this item — try the next one
    }
  }
  throw new Error("No inventory item with photos found in the first 8 items");
}

test("item detail: gallery strip opens editor overlay, close returns, strip survives reload", async ({ page }) => {
  await login(page);
  await openItemWithPhotos(page);

  // Gallery strip per the approved comp: PHOTOS · N label, Tap to edit hint,
  // COVER tag on the hero thumb, per-thumb edit affordance.
  await expect(page.getByText(/Photos · \d+/)).toBeVisible();
  await expect(page.getByText("COVER")).toBeVisible();
  const firstThumb = page.getByRole("button", { name: "Edit photo 1" });
  await expect(firstThumb).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "pg-1-strip.png"), fullPage: true });

  // Tap a thumb → full-screen editor overlay hosting all 4 tools
  // (rotate/crop plumbing ported to item detail in S2.5-6).
  await firstThumb.click();
  await expect(page.getByText(/Edit photo 1 of \d+/)).toBeVisible();
  await expect(page.getByText("Enhance")).toBeVisible();
  await expect(page.getByText("BG Remove")).toBeVisible();
  await expect(page.getByText("Rotate")).toBeVisible();
  await expect(page.getByText("Crop")).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "pg-2-editor-overlay.png") });

  // Crop opens the pan/zoom tool: stationary 1:1 window, movable image.
  await page.getByText("Crop").click();
  await expect(page.getByText(/drag to position/i)).toBeVisible();
  await expect(page.getByTestId("crop-window")).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "pg-2b-crop-panzoom.png") });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText(/drag to position/i)).toHaveCount(0);

  // Close discards and returns to the detail page with the strip intact.
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(page.getByText(/Edit photo 1 of \d+/)).toHaveCount(0);
  await expect(page.getByText("Tap to edit")).toBeVisible();

  // Reload → strip re-renders from the refetched item, not local state.
  await page.reload();
  await expect(page.getByText("Tap to edit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit photo 1" })).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "pg-3-strip-after-reload.png"), fullPage: true });
});

test("listing creation: hybrid compact mode hosts the gallery strip + editor overlay", async ({ page }) => {
  await login(page);
  await openItemWithPhotos(page);
  const itemId = page.url().split("/inventory/")[1];

  // Start a listing from this item — its photos seed the flow state.
  await page.goto(`/list?itemId=${itemId}`);

  // The compact toggle PERSISTS to user preferences, so a prior run may have
  // left compact mode on. Enter compact from either state; restore at the end.
  const toCompact = page.getByTitle("Switch to compact mode");
  const toChat = page.getByTitle("Switch to chat mode");
  await expect(toCompact.or(toChat)).toBeVisible();
  const wasChatMode = await toCompact.isVisible();
  if (wasChatMode) await toCompact.click();

  try {
    await expect(page.getByText("Tap to edit")).toBeVisible();
    await page.getByRole("button", { name: "Edit photo 1" }).click();
    await expect(page.getByText(/Edit photo 1 of \d+/)).toBeVisible();
    // Listing flows host all 4 tools.
    await expect(page.getByText("Rotate")).toBeVisible();
    await expect(page.getByText("Crop")).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "pg-6-listing-compact-editor.png") });

    await page.getByRole("button", { name: "Close editor" }).click();
    await expect(page.getByText("Tap to edit")).toBeVisible();
  } finally {
    // Leave the demo account's mode preference the way we found it.
    if (wasChatMode) await toChat.click();
  }
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("item detail: strip and editor overlay render in dark", async ({ page }) => {
    await login(page);
    await openItemWithPhotos(page);

    await expect(page.getByText(/Photos · \d+/)).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "pg-4-strip-dark.png"), fullPage: true });

    await page.getByRole("button", { name: "Edit photo 1" }).click();
    await expect(page.getByText(/Edit photo 1 of \d+/)).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "pg-5-editor-dark.png") });

    await page.getByRole("button", { name: "Close editor" }).click();
    await expect(page.getByText("Tap to edit")).toBeVisible();
  });
});
