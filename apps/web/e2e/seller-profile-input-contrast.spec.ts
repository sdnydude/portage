import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOT = path.join(process.cwd(), "test-results", "proof", "input-contrast");

// WCAG-ish relative luminance from a computed "rgb(r, g, b)" string.
function luminance(rgb: string): number {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error(`Unparseable color: ${rgb}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

async function assertReadable(page: Page, scheme: "light" | "dark") {
  const fields = [
    page.getByLabel(/Suggested-price percentile/i),
    page.getByLabel(/Auto-accept floor percentile/i),
    page.getByLabel(/Default listing footer/i),
    page.getByPlaceholder("Name"),
    page.getByLabel("Default Publish Mode"),
  ];
  for (const field of fields) {
    await expect(field).toBeVisible();
    const { color, bg, label } = await field.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, bg: s.backgroundColor, label: el.getAttribute("placeholder") ?? el.tagName };
    });
    const ratio = contrastRatio(color, bg);
    expect(ratio, `${scheme}: "${label}" text ${color} on ${bg} ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
  }
  await page.screenshot({ path: path.join(SHOT, `${scheme}-seller-profile-fields.png`), fullPage: true });
}

// Regression: pricing inputs/footer forced background:white with no text color,
// so dark mode rendered white-on-white. Every entry field on the page must have
// readable text in BOTH color schemes.
test("seller-profile entry fields are readable in light and dark mode", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/settings/seller-profile");
    await expect(page.getByRole("heading", { name: "Seller Profile" })).toBeVisible();
    await assertReadable(page, scheme);
  }
});
