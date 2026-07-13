import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "camzoom");

// Camera zoom e2e: fake camera via canvas.captureStream (same polyfill as
// camera-scan-save.spec.ts — :3002 is plain HTTP, so navigator.mediaDevices
// needs an init-script shim). A canvas track exposes no zoom capability, so
// the app must take the DIGITAL zoom path: chips set the factor, the
// viewfinder video scales by CSS, and capture still lands a photo.
const FAKE_CAMERA = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  const draw = () => {
    ctx.fillStyle = "#1A7A6D";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#FF5500";
    ctx.fillRect(280, 200, 80, 80); // small center square — zoom target
    ctx.fillStyle = "white";
    ctx.font = "20px sans-serif";
    ctx.fillText("E2E ZOOM", 270, 180);
  };
  draw();
  setInterval(draw, 100);
  const mediaDevices = {
    getUserMedia: async () => canvas.captureStream(15),
  };
  Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
};

test("camera zoom: chips zoom the viewfinder and capture still lands a photo", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(FAKE_CAMERA);

  // Photo upload mocked — the flow under test is the camera, not the save.
  await page.route(/\/images$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        image: { url: "https://picsum.photos/seed/camzoom/640/480", key: "e2e/camzoom.jpg", width: 640, height: 480 },
      }),
    });
  });

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.getByRole("button", { name: "Take Photo" }).click();

  const shutter = page.getByRole("button", { name: "Capture photo" });
  await expect(shutter).toBeEnabled({ timeout: 15_000 });

  // Zoom chips are on screen; 1× starts active.
  const chip1 = page.getByRole("button", { name: "Zoom 1×" });
  const chip2 = page.getByRole("button", { name: "Zoom 2×" });
  const chip3 = page.getByRole("button", { name: "Zoom 3×" });
  await expect(chip1).toBeVisible();
  await expect(chip2).toBeVisible();
  await expect(chip3).toBeVisible();
  await page.screenshot({ path: path.join(SHOT, "1-chips-1x.png") });

  // Canvas tracks have no zoom capability → digital path: the video element
  // must scale by the chosen factor.
  const video = page.locator("video");
  await chip2.click();
  await expect(video).toHaveCSS("transform", /matrix\(2,\s*0,\s*0,\s*2,/);
  await page.screenshot({ path: path.join(SHOT, "2-zoomed-2x.png") });

  await chip3.click();
  await expect(video).toHaveCSS("transform", /matrix\(3,\s*0,\s*0,\s*3,/);
  await page.screenshot({ path: path.join(SHOT, "3-zoomed-3x.png") });

  // Back to 1× removes the scale.
  await chip1.click();
  await expect(video).toHaveCSS("transform", "none");

  // Capture still works while zoomed.
  await chip2.click();
  await shutter.click();
  await expect(page.getByRole("button", { name: /Done — 1 photo/ })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(SHOT, "4-captured-at-2x.png") });

  // Close the camera without saving anything — nothing to clean up.
  await page.getByRole("button", { name: /Done — 1 photo/ }).click();
});
