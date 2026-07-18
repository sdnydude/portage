import { describe, it, expect } from "vitest";
import { cropRegionFromView, rescaleOffset } from "./pan-zoom-crop";

describe("cropRegionFromView", () => {
  it("at zoom 1 with no pan, a landscape image yields its centered square", () => {
    // 2000×1000 image in a 400px window: cover scale = 400/1000 = 0.4;
    // centered pan → x offset (2000*0.4 - 400)/2 = 200 display px → 500 image px.
    expect(
      cropRegionFromView({ imageWidth: 2000, imageHeight: 1000, windowSide: 400, zoom: 1, offsetX: -200, offsetY: 0 }),
    ).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it("zooming in shrinks the crop; pans are clamped so the window stays covered", () => {
    // zoom 2 on a 1000×1000 image, 400px window: scale 0.8; crop side 500.
    // offsetX -400 → x = 500; offsetY pushed past the clamp (must pin to edge).
    expect(
      cropRegionFromView({ imageWidth: 1000, imageHeight: 1000, windowSide: 400, zoom: 2, offsetX: -400, offsetY: 999 }),
    ).toEqual({ x: 500, y: 0, width: 500, height: 500 });
    // Over-pan on the far edge clamps to windowSide - imageSide.
    expect(
      cropRegionFromView({ imageWidth: 1000, imageHeight: 1000, windowSide: 400, zoom: 2, offsetX: -9999, offsetY: -400 }),
    ).toEqual({ x: 500, y: 500, width: 500, height: 500 });
  });
});

describe("rescaleOffset — keeps the anchor point stationary through a zoom change", () => {
  it("center-anchored zoom in doubles the distance from the anchor", () => {
    // Window 400, anchor center (200). offset -100 at scale 1 → at scale 2 the
    // anchor's image point must stay put: offset' = 200 - (200 - (-100)) * 2 = -400.
    expect(rescaleOffset(-100, 200, 2)).toBe(-400);
  });
});
