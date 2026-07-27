import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

const SHOT = path.join(process.cwd(), "test-results", "proof", "overlay-audit");

// Beta report 7c9a499b follow-up: the floating TabBar (fixed, z-50) must never
// cover an interactive element. This audit walks every mobile route, scrolls
// to the bottom, and intersects the bar's bounding box with every visible
// interactive element — a real-pixels gate, not a class-name assertion.
const ROUTES = [
  "/home",
  "/inventory",
  "/porter",
  "/orders",
  "/listings",
  "/messages",
  "/beta/report",
  "/settings",
  "/settings/seller-profile",
  "/settings/billing",
  "/settings/marketplace",
  "/settings/notifications",
  "/settings/help",
];

/**
 * A control is occluded when the TOPMOST element at its center point belongs
 * to the tab bar instead of the control (or one of its ancestors/descendants).
 * elementFromPoint is the ground truth for "would a tap land on this button" —
 * plain bounding-box intersection false-flags dialogs that correctly stack
 * ABOVE the bar (their backdrop overlaps the bar's box by design).
 */
async function overlappedControls(page: Page): Promise<string[]> {
  const bar = page.locator("nav.glass-nav, nav[class*='glass-nav']").first();
  if (!(await bar.isVisible().catch(() => false))) return [];

  return page.evaluate(() => {
    const nav = document.querySelector("nav[class*='glass-nav']");
    if (!nav) return [];
    const hits: string[] = [];
    const controls = document.querySelectorAll<HTMLElement>(
      "button, a, input, select, textarea, [role='button']",
    );
    for (const el of controls) {
      if (nav.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue; // hidden/collapsed
      if (r.bottom < 0 || r.top > window.innerHeight) continue; // offscreen
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      if (top && nav.contains(top)) {
        const label = (el.textContent?.trim()
          || el.getAttribute("aria-label")
          || el.getAttribute("placeholder")
          || el.tagName).slice(0, 60);
        hits.push(label);
      }
    }
    return hits;
  });
}

test.use({ viewport: { width: 390, height: 844 } });

test("TabBar never covers an interactive element on any mobile route (bottom-scrolled)", async ({ page }) => {
  test.setTimeout(180_000);
  await installSessionStub(page);

  const violations: Array<{ route: string; controls: string[] }> = [];
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    // Bottom of the page is where submit buttons live and where the bar bites.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400); // bar compact/expand transition settles
    const hits = await overlappedControls(page);
    const slug = route.replace(/\//g, "_") || "_root";
    await page.screenshot({ path: path.join(SHOT, `${hits.length ? "FAIL" : "ok"}${slug}.png`), fullPage: false });
    if (hits.length) violations.push({ route, controls: hits });
  }

  expect(violations, `TabBar occludes interactive elements:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
});

test("TabBar never covers bottom-sheet dialog buttons (ConfirmSheet delete flow)", async ({ page }) => {
  // The dialog class of the same bug: bottom sheets rendered before the bar in
  // DOM lose z-50 ties and their action buttons get covered (beta 7c9a499b).
  await installSessionStub(page);
  await page.goto("/home");
  const token = (await page.evaluate(() => localStorage.getItem("portage_token")))!;
  const headers = { Authorization: `Bearer ${token}` };
  const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";
  const itemRes = await page.request.post(`${API_BASE}/items`, {
    headers, data: { title: "E2E overlay-audit dialog item" },
  });
  expect(itemRes.ok()).toBeTruthy();
  const itemId = (await itemRes.json()).id as string;
  try {
    await page.goto(`/inventory/${itemId}`);
    await page.getByRole("button", { name: /^Delete/ }).first().click();
    const confirmBtn = page.getByRole("button", { name: /Delete/i }).last();
    await expect(confirmBtn).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, "dialog_confirm-sheet.png") });
    const hits = await overlappedControls(page);
    expect(hits, `TabBar occludes dialog controls: ${hits.join(", ")}`).toEqual([]);
    // Actionability double-proof: the covered-button failure mode times this out.
    await confirmBtn.click();
  } finally {
    await page.request.delete(`${API_BASE}/items/${itemId}`, { headers }).catch(() => {});
  }
});
