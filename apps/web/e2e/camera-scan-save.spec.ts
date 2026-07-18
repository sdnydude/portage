import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "camscan");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

// Burndown 3.3: prove Phase E end-to-end WITHOUT real camera hardware.
// :3002 is plain HTTP on the LAN, so navigator.mediaDevices does not exist
// (secure-context gate) — an init-script polyfill provides getUserMedia
// backed by canvas.captureStream(), which is NOT secure-context gated. The
// real camera path still runs: getUserMedia → <video> → canvas → File.
// The AI boundary is mocked at the network layer (/scan/refine, /images,
// comps, category-suggestion) so the flow is deterministic and CI-safe;
// the SAVE is real — POST /items hits the API and the item must survive a
// reload before the spec deletes it.
const FAKE_CAMERA = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  const draw = () => {
    ctx.fillStyle = "#2D5A27";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#F77E2D";
    ctx.fillRect(160, 120, 320, 240);
    ctx.fillStyle = "white";
    ctx.font = "28px sans-serif";
    ctx.fillText("E2E FAKE CAMERA", 200, 250);
  };
  draw();
  setInterval(draw, 100); // keep frames flowing so <video> plays
  const mediaDevices = {
    getUserMedia: async () => canvas.captureStream(15),
  };
  Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
};

const CANDIDATE = {
  name: "E2E Camera Scan Stanley No. 4 Plane",
  description: "Vintage smoothing plane captured via fake camera in e2e.",
  category: "tools",
  condition: "good",
  conditionNotes: "Light surface patina.",
  estimatedValueLow: 40,
  estimatedValueHigh: 60,
  brand: "Stanley",
  model: "No. 4",
  features: ["cast iron", "rosewood tote"],
  confidence: 0.93,
  weight: { value: 72, unit: "oz" },
  dimensions: { length: 10, width: 3, height: 6, unit: "in" },
};

test("camera-driven scan → review → save lands a real item", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(FAKE_CAMERA);

  // ── Network boundary mocks (AI + marketplace reads only; save stays real)
  await page.route(/\/images$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        image: { url: "https://picsum.photos/seed/camscan/640/480", key: "e2e/camscan.jpg", width: 640, height: 480 },
      }),
    });
  });
  await page.route(/\/scan\/refine$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ detailed: { candidates: [CANDIDATE], reasoning: "e2e fixture" } }),
    });
  });
  await page.route(/\/items\/comps\/search/, (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.route(/\/marketplace\/ebay\/category-suggestion/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        suggestion: { categoryId: "183166", categoryName: "Hand Planes", conditionIds: [] },
      }),
    }),
  );
  await page.route(/\/marketplace\/ebay\/category-aspects\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ aspects: {} }) }),
  );

  // ── Drive the real camera path
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.getByRole("button", { name: "Take Photo" }).click();

  const shutter = page.getByRole("button", { name: "Capture photo" });
  await expect(shutter).toBeEnabled({ timeout: 15_000 }); // fake stream ready
  // 1:1 discipline: the square capture guide overlays the viewfinder, and
  // capture() crops exactly the guided region (guideCaptureRect).
  await expect(page.getByTestId("square-guide")).toBeVisible();
  await page.screenshot({ path: path.join(SHOT, "1-viewfinder.png") });
  await shutter.click();

  // Multi-shot: the camera session stays open after the shutter (one
  // getUserMedia per session — no iOS/macOS permission re-prompt on photo
  // 2+). The shot lands on the Done badge; Done closes the session.
  const done = page.getByRole("button", { name: /Done — 1 photo/ });
  await expect(done).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(SHOT, "1b-multishot-done.png") });
  await done.click();

  // Captured frame uploads (mocked) and appears in the photo strip
  await expect(page.getByRole("button", { name: /Scan 1 Photo/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Scan 1 Photo/ }).click();

  // ── Review is populated from the mocked candidate (the Item Name label has
  // no htmlFor association, so scope to its wrapping div)
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('div:has(> label:has-text("Item Name")) > input')).toHaveValue(CANDIDATE.name);
  await page.getByLabel(/Price/).first().fill("49.99");
  await page.screenshot({ path: path.join(SHOT, "2-review.png"), fullPage: true });

  // ── Save is REAL — the item must land in the DB
  const [saveResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/items"),
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  expect(saveResp.ok()).toBeTruthy();
  const saved = await saveResp.json();
  expect(saved.id, "save must return the created item id").toBeTruthy();

  // Scan flow closes back to inventory; the item survives a reload
  await page.goto("/inventory");
  await expect(page.getByText(CANDIDATE.name).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(SHOT, "3-inventory-saved.png"), fullPage: true });

  // ── Cleanup: remove the e2e item so reruns stay idempotent
  const token = await page.evaluate(() => localStorage.getItem("portage_token"));
  const del = await page.request.delete(`${API_BASE}/items/${saved.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(del.ok()).toBeTruthy();
});
