import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");
const API = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

// The session comes from auth.setup.ts via storageState — no per-test login
// (the API auth limiter is 10-in-15min).
async function token(page: Page): Promise<string> {
  await page.goto("/home");
  await page.waitForURL("**/home");
  const t = await page.evaluate(() => localStorage.getItem("portage_token"));
  expect(t).toBeTruthy();
  return t!;
}

/** Opens the first inventory item that has a photo gallery; returns its id. */
async function openFirstItemWithPhotos(page: Page): Promise<string> {
  await page.goto("/inventory");
  const links = page.locator('a[href^="/inventory/"]');
  await expect(links.first()).toBeVisible();
  const count = Math.min(await links.count(), 8);
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    if (!href) continue;
    await page.goto(href);
    // Let the detail page settle before probing for the gallery.
    await expect(page.getByRole("button", { name: "Edit item" })).toBeVisible({ timeout: 10_000 });
    const gallery = page.getByRole("button", { name: /edit photo 1/i });
    if (await gallery.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false)) {
      return href.split("/").pop()!;
    }
    await page.goto("/inventory");
  }
  throw new Error("No inventory item with photos found for the e2e run");
}

/** Snapshot the item's photos array so the test can restore it (non-destructive). */
async function snapshotPhotos(page: Page, itemId: string, authToken: string): Promise<unknown> {
  const res = await page.request.get(`${API}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return (body.item ?? body).photos;
}

async function restorePhotos(page: Page, itemId: string, authToken: string, photos: unknown) {
  const res = await page.request.patch(`${API}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
    data: { photos },
  });
  expect(res.ok()).toBe(true);
}

test.describe("photo tools", () => {
  test("Exposure tool: +1 EV applies via /images/exposure and persists across reload", async ({ page }) => {
    test.setTimeout(120_000);
    const authToken = await token(page);
    const itemId = await openFirstItemWithPhotos(page);
    const originalPhotos = await snapshotPhotos(page, itemId, authToken);

    try {
      await page.getByRole("button", { name: /edit photo 1/i }).click();
      await page.getByRole("button", { name: /exposure/i }).click();

      // The EV slider overlay with live preview.
      const slider = page.getByRole("slider");
      await expect(slider).toBeVisible();
      await slider.fill("1");
      await expect(page.getByText("+1 EV")).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, "exposure-1-slider.png"), fullPage: true });

      const exposureResponse = page.waitForResponse((r) => r.url().includes("/images/exposure") && r.status() === 200);
      await page.getByRole("button", { name: "Apply" }).click();
      await exposureResponse;

      // Back in the editor with the brightened photo (server wrote *_exposure.jpg).
      const editorImg = page.locator('img[alt^="Photo 1"]').last();
      await expect(editorImg).toHaveAttribute("src", /_exposure\.jpg/, { timeout: 15_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, "exposure-2-applied.png"), fullPage: true });

      // Reload → proves the PATCH persisted, not just local state.
      await page.reload();
      await page.getByRole("button", { name: /edit photo 1/i }).click();
      await expect(page.locator('img[alt^="Photo 1"]').last()).toHaveAttribute("src", /_exposure\.jpg/);
      await page.screenshot({ path: path.join(SHOT_DIR, "exposure-3-persisted-after-reload.png"), fullPage: true });
    } finally {
      await restorePhotos(page, itemId, authToken, originalPhotos);
    }
  });

  test("BG Remove runs inline (no interstitial CTA) and saves a white background, not black", async ({ page }) => {
    test.setTimeout(180_000); // rembg inference can be slow
    const authToken = await token(page);
    const itemId = await openFirstItemWithPhotos(page);
    const originalPhotos = await snapshotPhotos(page, itemId, authToken);

    try {
      await page.getByRole("button", { name: /edit photo 1/i }).click();

      const bgResponse = page.waitForResponse(
        (r) => r.url().includes("/images/remove-bg") && r.status() === 200,
        { timeout: 150_000 },
      );
      await page.getByRole("button", { name: /bg remove/i }).click();

      // No interstitial CTA page — the removal starts immediately in the editor.
      await expect(page.getByRole("button", { name: /^remove background$/i })).toHaveCount(0);
      await expect(page.getByText("Removing background...")).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, "bg-1-inline-processing.png"), fullPage: true });

      await bgResponse;

      // Result surfaces as the accept/discard preview inside the same editor.
      const accept = page.getByRole("button", { name: /use this photo/i });
      await expect(accept).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, "bg-2-before-after-preview.png"), fullPage: true });
      await accept.click();

      const editorImg = page.locator('img[alt^="Photo 1"]').last();
      await expect(editorImg).toHaveAttribute("src", /_nobg\.jpg/, { timeout: 15_000 });

      // Pixel proof: the SAVED file's corner is WHITE (the old bug saved a
      // transparent PNG that rendered black). Fetch server-side (no CORS taint)
      // and sample via a data-URL canvas.
      const src = await editorImg.getAttribute("src");
      const imgRes = await page.request.get(src!);
      expect(imgRes.ok()).toBe(true);
      const b64 = (await imgRes.body()).toString("base64");
      const corner = await page.evaluate(async (dataUrl) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(2, 2, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2] };
      }, `data:image/jpeg;base64,${b64}`);
      expect(corner.r).toBeGreaterThan(230);
      expect(corner.g).toBeGreaterThan(230);
      expect(corner.b).toBeGreaterThan(230);

      // Reload → persisted.
      await page.reload();
      await page.getByRole("button", { name: /edit photo 1/i }).click();
      await expect(page.locator('img[alt^="Photo 1"]').last()).toHaveAttribute("src", /_nobg\.jpg/);
      await page.screenshot({ path: path.join(SHOT_DIR, "bg-3-white-persisted-after-reload.png"), fullPage: true });
    } finally {
      await restorePhotos(page, itemId, authToken, originalPhotos);
    }
  });
});
