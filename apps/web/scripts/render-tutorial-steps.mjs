// Render every tutorial step in the player and screenshot each one.
// Usage: node render-steps.mjs [topicSlug ...]  (default: all 8)
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.RENDER_BASE ?? "http://localhost:3005";
const OUT = process.env.RENDER_OUT ?? "/tmp/claude-1000/-home-swebber64-DHG-portage/f32c4d22-f926-403e-a313-dbb71e2f6881/scratchpad/step-renders";
const ALL = ["setup", "adding-items", "listings", "inventory", "orders", "settings", "porter", "messages"];
const topics = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
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
await b.close();
