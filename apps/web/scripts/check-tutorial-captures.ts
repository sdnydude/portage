// Run: npx tsx scripts/check-tutorial-captures.ts
/**
 * Objective gate for tutorial screenshots (P4): every step's PNG exists, has
 * the capture viewport's dimensions (390x844 @2x), and is not a blank/error
 * frame (pixel stddev above a floor). Prints one line per step; exits 1 on
 * any failure so "zero-defect published assets" is a script result, not a
 * promise. Manual review is then only the flagged files plus the ones whose
 * copy changed.
 *   npx tsx scripts/check-tutorial-captures.ts
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { TUTORIAL_TOPICS } from "../src/lib/tutorials/index";
import { assessCapture } from "../src/lib/tutorials/capture-check";

const ROOT = path.resolve(__dirname, "../public");
async function main(): Promise<number> {
let failures = 0;
for (const topic of TUTORIAL_TOPICS) {
  for (const step of topic.steps) {
    const file = path.join(ROOT, step.screenshot);
    const label = `${topic.slug}/${step.id}`;
    if (!fs.existsSync(file)) { console.log(`FAIL ${label}: missing ${step.screenshot}`); failures++; continue; }
    const img = sharp(file);
    const meta = await img.metadata();
    const stats = await img.greyscale().stats();
    const sd = stats.channels[0].stdev;
    const mtime = fs.statSync(file).mtime.toISOString().slice(0, 16);
    const problems = assessCapture({ width: meta.width ?? 0, height: meta.height ?? 0, stddev: sd, overlays: step.overlays ?? [] });
    if (problems.length) { failures++; console.log(`FAIL ${label}: ${problems.join("; ")}`); }
    else console.log(`ok   ${label}  stddev=${sd.toFixed(1)}  ${mtime}`);
  }
}
console.log(failures ? `${failures} capture(s) need attention` : "all captures pass");
return failures ? 1 : 0;
}

main().then((code) => process.exit(code));
