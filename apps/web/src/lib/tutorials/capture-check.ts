import type { Overlay } from "./types";

/** Capture viewport shared by capture-tutorials.ts, render-tutorial-steps.mjs and the gate. */
export const TUTORIAL_VIEWPORT = { width: 390, height: 844 } as const;
/** Captures are taken at deviceScaleFactor 2. */
export const CAPTURE_SCALE = 2;
/** Below this greyscale stddev a PNG is a blank/error frame, not a screen. */
export const MIN_STDDEV = 12;

export interface CaptureFacts {
  width: number;
  height: number;
  stddev: number;
  overlays: readonly Overlay[];
}

/** Problems with one tutorial screenshot; empty means it passes the gate. */
export function assessCapture(f: CaptureFacts): string[] {
  const problems: string[] = [];
  const W = TUTORIAL_VIEWPORT.width * CAPTURE_SCALE, H = TUTORIAL_VIEWPORT.height * CAPTURE_SCALE;
  if (f.width !== W || f.height !== H) problems.push(`size ${f.width}x${f.height}`);
  if (f.stddev < MIN_STDDEV) problems.push(`blank-ish stddev=${f.stddev.toFixed(1)}`);
  for (const o of f.overlays) {
    if (o.x < 0 || o.y < 0 || o.x + (o.w ?? 0) > 100 || o.y + (o.h ?? 0) > 100) problems.push(`overlay off-canvas ${JSON.stringify(o)}`);
  }
  return problems;
}
