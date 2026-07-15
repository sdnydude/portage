// Render every tutorial step in the player and screenshot each one for
// visual QA of overlay placement (run after any capture:tutorials refresh).
// Needs a dev server (default :3005): PORT=3005 npx next dev -p 3005
// Usage: node scripts/render-tutorial-steps.mjs [topicSlug ...]  (default: all 8)
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.RENDER_BASE ?? "http://localhost:3005";
const OUT = process.env.RENDER_OUT ?? "test-results/step-renders";
const ALL = ["setup", "adding-items", "listings", "inventory", "orders", "settings", "porter", "messages"];
const topics = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
try {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  for (const slug of topics) {
    await p.goto(`${BASE}/tutorials/${slug}`, { waitUntil: "networkidle" });
    for (let step = 1; step <= 3; step++) {
      await p.waitForTimeout(900); // let overlay animations reach steady state
      await p.screenshot({ path: `${OUT}/${slug}-step${step}.png` });
      const next = p.getByRole("button", { name: "Next", exact: true });
      if (step < 3 && (await next.count())) await next.click();
    }
    console.log(`rendered ${slug}`);
  }
} finally {
  await b.close();
}
