import { describe, it, expect } from "vitest";
import { assessCapture, TUTORIAL_VIEWPORT } from "./capture-check";

describe("assessCapture (objective gate for tutorial screenshots)", () => {
  it("flags wrong size, blank frames and off-canvas overlays; passes a real capture", () => {
    const w = TUTORIAL_VIEWPORT.width * 2, h = TUTORIAL_VIEWPORT.height * 2;
    expect(assessCapture({ width: w, height: h, stddev: 40, overlays: [{ type: "highlight", x: 6, y: 15, w: 88, h: 31 }] })).toEqual([]);
    expect(assessCapture({ width: 390, height: 844, stddev: 40, overlays: [] })).toEqual(["size 390x844"]);
    expect(assessCapture({ width: w, height: h, stddev: 3.2, overlays: [] })).toEqual(["blank-ish stddev=3.2"]);
    expect(assessCapture({ width: w, height: h, stddev: 40, overlays: [{ type: "tap", x: 95, y: 10, w: 10 }] })[0]).toMatch(/off-canvas/);
  });
});
