/**
 * Tutorial screenshot capture pipeline.
 *
 * Regenerates apps/web/public/tutorials/<topic>/<step>.png from the capture
 * manifests exported by src/lib/tutorials. Run against a LIVE app whenever the
 * UI changes, then commit the PNGs:
 *
 *   npm run capture:tutorials            # app on :3002, API on :8016
 *   CAPTURE_BASE_URL=... CAPTURE_API_URL=... npm run capture:tutorials
 *
 * Auth mirrors e2e/auth.setup.ts: GET /auth/session (CF_ACCESS_DEV_EMAIL dev
 * bypass on LAN, or CF Access service token via E2E_CF_CLIENT_ID/SECRET),
 * localStorage injection, plus the session-stub route so the app's mount-time
 * edge exchange can't wipe the injected token. NOT run in CI.
 */
import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { installSessionStub } from "../e2e/session-stub";
import { CAPTURE_MANIFESTS } from "../src/lib/tutorials/index";
import type { CaptureAction } from "../src/lib/tutorials/types";

const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://10.0.0.251:3002";
const API_URL = process.env.CAPTURE_API_URL ?? "https://10.0.0.251:8016";
const OUT_ROOT = path.resolve(__dirname, "../public/tutorials");
const VIEWPORT = { width: 390, height: 844 };

async function getSession(): Promise<{ token: string; user: unknown }> {
  const headers: Record<string, string> = {};
  if (process.env.E2E_CF_CLIENT_ID && process.env.E2E_CF_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = process.env.E2E_CF_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = process.env.E2E_CF_CLIENT_SECRET;
  }
  const res = await fetch(`${API_URL}/auth/session`, { headers });
  if (!res.ok) throw new Error(`session exchange failed: ${res.status}`);
  return (await res.json()) as { token: string; user: unknown };
}

let skips = 0;

async function runAction(page: Page, topic: string, action: CaptureAction): Promise<void> {
  switch (action.type) {
    case "goto":
      await page.goto(`${BASE_URL}${action.path}`, { waitUntil: "networkidle" });
      return;
    case "click": {
      // visible=true: the R0 shell keeps CSS-hidden desktop chrome (TopBar,
      // Sidebar) React-mounted at mobile widths, so a bare .first() can land
      // on an invisible duplicate.
      const el = page.locator(action.selector).locator("visible=true").first();
      if ((await el.count()) === 0) {
        skips++;
        console.warn(`[${topic}] click target missing, skipping: ${action.selector}`);
        return;
      }
      await el.click();
      return;
    }
    case "fill": {
      const el = page.locator(action.selector).locator("visible=true").first();
      if ((await el.count()) === 0) {
        skips++;
        console.warn(`[${topic}] fill target missing, skipping: ${action.selector}`);
        return;
      }
      await el.fill(action.value);
      return;
    }
    case "wait":
      await page.waitForTimeout(action.ms);
      return;
    case "capture": {
      const dir = path.join(OUT_ROOT, topic);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${action.step}.png`);
      await page.screenshot({ path: file });
      console.log(`captured ${path.relative(process.cwd(), file)}`);
      return;
    }
  }
}

async function main(): Promise<void> {
  const session = await getSession();

  const browser = await chromium.launch();
  try {
    await run(browser, session);
  } finally {
    await browser.close();
  }
}

async function run(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  session: { token: string; user: unknown },
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(BASE_URL).origin,
          localStorage: [
            { name: "portage_token", value: session.token },
            { name: "portage_user", value: JSON.stringify(session.user) },
          ],
        },
      ],
    },
  });
  const page = await context.newPage();
  // Reuse the proven e2e session stub (one copy to keep in sync): answers the
  // app's mount-time edge exchange with the session seeded in storage state;
  // every data call below it stays real.
  await installSessionStub(page);
  // Published-asset hygiene: the beta-report FAB is app chrome, not product —
  // it must not appear in tutorial/marketing captures (zero-error gate).
  // Init script (not addStyleTag): survives every goto in the capture loop.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = '[aria-label="Report a beta issue"] { display: none !important; }';
      document.head.appendChild(style);
    });
  });

  // Optional topic filter: `npm run capture:tutorials -- setup settings`
  // (mixed-account capture: account-type screens shoot as the demo account
  // so no personal data lands in published assets).
  const only = process.argv.slice(2);
  let failures = 0;
  for (const manifest of CAPTURE_MANIFESTS) {
    if (only.length && !only.includes(manifest.topic)) continue;
    console.log(`\n=== topic: ${manifest.topic} ===`);
    for (const action of manifest.actions) {
      try {
        await runAction(page, manifest.topic, action);
      } catch (err) {
        failures++;
        console.error(`[${manifest.topic}] action failed:`, action, err);
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} action(s) failed`);
    process.exit(1);
  }
  if (skips > 0) {
    // Skips are by design (empty demo states reuse the previous frame), but
    // they must never read as silent success — a selector broken by a UI
    // change looks identical to an empty state.
    console.warn(`\nAll captures complete with ${skips} skipped click/fill action(s) — verify the affected PNGs.`);
    return;
  }
  console.log("\nAll captures complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
