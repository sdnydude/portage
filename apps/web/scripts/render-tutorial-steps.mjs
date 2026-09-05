// Render every tutorial step in the player and screenshot each one for
// visual QA of overlay placement (run after any capture:tutorials refresh).
// Target: a dev server (default :3005) or the running app (RENDER_BASE=http://10.0.0.251:3002).
// Auth: /tutorials needs a session — RENDER_STORAGE_STATE (default e2e/.auth/user.json,
// minted locally; see e2e/auth.setup.ts) is loaded as Playwright storage state.
// Usage: node scripts/render-tutorial-steps.mjs [topicSlug ...]  (default: all 8)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { installSessionStub } from "../e2e/session-stub.ts";
import { TUTORIAL_VIEWPORT } from "../src/lib/tutorials/capture-check.ts";
const BASE = process.env.RENDER_BASE ?? "http://localhost:3005";
const OUT = process.env.RENDER_OUT ?? "test-results/step-renders";
const ALL = ["setup", "adding-items", "listings", "inventory", "orders", "settings", "porter", "messages"];
const topics = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
try {
  // Same session shape the capture script builds: the minted e2e storage
  // state re-homed to RENDER_BASE's origin, plus the shared session stub.
  const stateFile = process.env.RENDER_STORAGE_STATE ?? "e2e/.auth/user.json";
  const hasState = fs.existsSync(stateFile);
  const ls = hasState ? JSON.parse(fs.readFileSync(stateFile, "utf8")).origins.flatMap((o) => o.localStorage) : [];
  if (hasState && !ls.some((e) => e.name === "portage_token")) throw new Error(`${stateFile} has no portage_token — re-mint the session before rendering`);
  const ctx = await b.newContext({
    viewport: TUTORIAL_VIEWPORT,
    ...(hasState ? { storageState: { cookies: [], origins: [{ origin: new URL(BASE).origin, localStorage: ls }] } } : {}),
  });
  const p = await ctx.newPage();
  if (hasState) await installSessionStub(p);
  for (const slug of topics) {
    await p.goto(`${BASE}/tutorials/${slug}`, { waitUntil: "networkidle" });
    for (let step = 1; step <= 3; step++) {
      await p.waitForTimeout(900); // let overlay animations reach steady state
      await p.screenshot({ path: `${OUT}/${slug}-step${step}.png` });
      const next = p.getByRole("button", { name: "Next step", exact: true });
      if (step < 3 && (await next.count())) await next.click();
    }
    console.log(`rendered ${slug}`);
  }
} finally {
  await b.close();
}
