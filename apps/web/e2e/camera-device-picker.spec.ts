import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "campicker");

// Continuity Camera scenario without hardware: TWO fake cameras (solid red
// built-in, solid blue "iPhone"), an enumerateDevices that lists both, and a
// getUserMedia that honors deviceId — exactly the shape macOS presents when
// an iPhone is in Continuity range. Proves: picker appears, pinning the
// iPhone switches the live stream, and the choice survives a reload.
const FAKE_DUAL_CAMERAS = () => {
  const makeCam = (color: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 640, 480);
    };
    draw();
    setInterval(draw, 100);
    return canvas;
  };
  const builtin = makeCam("#CC0000");
  const iphone = makeCam("#0000CC");
  const mediaDevices = {
    getUserMedia: async (c: { video?: { deviceId?: { exact?: string } } }) =>
      (c.video?.deviceId?.exact === "iphone-cam" ? iphone : builtin).captureStream(15),
    enumerateDevices: async () => [
      { kind: "videoinput", deviceId: "builtin-cam", label: "FaceTime HD Camera" },
      { kind: "videoinput", deviceId: "iphone-cam", label: "iPhone Camera" },
    ],
  };
  Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
};

// Sample the center pixel of the live <video> element.
const centerPixel = (page: Page) =>
  page.evaluate(() => {
    const video = document.querySelector("video")!;
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(video, 318, 238, 4, 4, 0, 0, 4, 4);
    const [r, g, b] = ctx.getImageData(2, 2, 1, 1).data;
    return { r, g, b };
  });

test("device picker pins the iPhone camera and remembers it across reload", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(FAKE_DUAL_CAMERAS);

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.getByRole("button", { name: "Take Photo" }).click();

  const shutter = page.getByRole("button", { name: "Capture photo" });
  await expect(shutter).toBeEnabled({ timeout: 15_000 });

  // Default stream = built-in (red).
  await expect.poll(async () => (await centerPixel(page)).r, { timeout: 10_000 }).toBeGreaterThan(150);
  await page.screenshot({ path: path.join(SHOT, "1-builtin-red.png") });

  // Picker lists both cameras; pin the iPhone.
  await page.getByRole("button", { name: "Choose camera" }).click();
  await expect(page.getByRole("button", { name: "FaceTime HD Camera" })).toBeVisible();
  await page.screenshot({ path: path.join(SHOT, "2-picker-open.png") });
  await page.getByRole("button", { name: "iPhone Camera" }).click();

  // Live stream switches to the iPhone (blue).
  await expect.poll(async () => (await centerPixel(page)).b, { timeout: 10_000 }).toBeGreaterThan(150);
  await expect.poll(async () => (await centerPixel(page)).r, { timeout: 10_000 }).toBeLessThan(100);
  await page.screenshot({ path: path.join(SHOT, "3-iphone-blue.png") });

  // Choice persists: reload, reopen the camera, iPhone comes up immediately.
  await page.reload();
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.getByRole("button", { name: "Take Photo" }).click();
  await expect(page.getByRole("button", { name: "Capture photo" })).toBeEnabled({ timeout: 15_000 });
  await expect.poll(async () => (await centerPixel(page)).b, { timeout: 10_000 }).toBeGreaterThan(150);
  await page.screenshot({ path: path.join(SHOT, "4-reload-still-iphone.png") });
});
