import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "fresh-scan");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

// Fresh-scan prepare (PR A): confirming recognition on a brand-new capture must
// CREATE the inventory item (previously publish-time only) and run prepare so
// the ListingPreviewCard + CompsPricingWidget render on the fresh path. The
// AI boundary (/scan) and prepare-listing are network-mocked for determinism;
// the POST /items is REAL — the item must survive into /inventory, where the
// new "Unlisted" chip marks it as not yet on a marketplace.
const CANDIDATE = {
  name: "E2E Fresh Scan Tascam DR-05 Recorder",
  category: "electronics",
  condition: "good",
  conditionNotes: "",
  description: "Portable PCM recorder captured by the fresh-scan e2e.",
  estimatedValueLow: 55,
  estimatedValueHigh: 85,
  brand: "Tascam",
  model: "DR-05",
  features: ["built-in mics"],
  confidence: 0.91,
};

const PREPARED = {
  title: "Tascam DR-05 Portable PCM Recorder — Tested, Works",
  description: "Clean portable recorder.",
  condition: "good",
  conditionDescription: "Light wear, fully functional.",
  brand: "Tascam",
  model: "DR-05",
  pricing: { suggested: 68, low: 55, high: 85, currency: "USD", confidence: "high", basedOn: 6, conditionMatch: "exact" },
  comps: { ebay: null, reverb: null },
  ebay: null,
  reverb: null,
  isMusicGear: false,
  aiConfidence: 0.91,
  warnings: [],
};

test("fresh scan: confirm creates the item, prepare renders the preview card; inventory shows Unlisted", async ({ page, request }) => {
  test.setTimeout(120_000);
  let itemId: string | null = null;

  await page.goto("/home");
  const token = await page.evaluate(() => localStorage.getItem("portage_token"));

  // Force the hybrid flow (capture the original preference; restored below).
  const prefsRes = await request.get(`${API_BASE}/users/me/preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const originalInterface = (await prefsRes.json())?.listingInterface ?? "hybrid";
  await request.patch(`${API_BASE}/users/me/preferences`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { listingInterface: "hybrid" },
  });

  // Deterministic AI boundary. POST-only guards: never intercept navigations.
  await page.route(/\/scan(\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        identification: CANDIDATE,
        detailed: { candidates: [CANDIDATE], reasoning: ["Body shape and mic layout match the DR-05."] },
        image: { url: "https://picsum.photos/seed/freshscan/640/640", key: "e2e/fresh-scan.jpg", width: 640, height: 640 },
      }),
    });
  });
  await page.route(/\/prepare-listing$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(PREPARED) });
  });

  try {
    await test.step("capture → recognition → Looks right creates the item", async () => {
      await page.goto("/list");
      await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));

      const confirmPill = page.getByText("Looks right", { exact: true });
      await expect(confirmPill).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: path.join(SHOT, "1-recognition.png"), fullPage: true });

      const [itemsResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/items"),
          { timeout: 30_000 },
        ),
        confirmPill.click(),
      ]);
      expect(itemsResp.ok()).toBeTruthy();
      itemId = (await itemsResp.json())?.id ?? null;
      expect(itemId, "confirm must create the inventory item").toBeTruthy();
    });

    await test.step("preview card + pricing render on the fresh path", async () => {
      await expect(page.getByText("Suggested Price")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /Publish to eBay/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /edit this photo/i })).toBeVisible();
      await page.screenshot({ path: path.join(SHOT, "2-preview-card.png"), fullPage: true });
    });

    await test.step("inventory shows the created item with the Unlisted chip", async () => {
      await page.goto("/inventory");
      await expect(page.getByText(CANDIDATE.name)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Unlisted").first()).toBeVisible();
      await page.screenshot({ path: path.join(SHOT, "3-inventory-unlisted.png"), fullPage: true });
    });
  } finally {
    if (itemId) {
      await request.delete(`${API_BASE}/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    await request.patch(`${API_BASE}/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { listingInterface: originalInterface },
    });
  }
});
