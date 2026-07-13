import { describe, it, expect } from "vitest";
import { squareCaptureRect, guideCaptureRect, applyZoom } from "./square-capture";

describe("squareCaptureRect", () => {
  it("crops the centered square of a landscape frame and caps output at 2000", () => {
    expect(squareCaptureRect(4032, 3024)).toEqual({ sx: 504, sy: 0, size: 3024, out: 2000 });
  });

  it("handles portrait frames and keeps small frames at native size", () => {
    expect(squareCaptureRect(480, 640)).toEqual({ sx: 0, sy: 80, size: 480, out: 480 });
    expect(squareCaptureRect(640, 480)).toEqual({ sx: 80, sy: 0, size: 480, out: 480 });
  });
});

describe("applyZoom — shrinks a capture rect around its center for digital zoom", () => {
  it("2x zoom halves the crop side, keeping it centered", () => {
    expect(applyZoom({ sx: 750, sy: 250, size: 500, out: 500 }, 2)).toEqual({
      sx: 875,
      sy: 375,
      size: 250,
      out: 250,
    });
  });
});

describe("guideCaptureRect — maps the on-screen guide square to video coords under object-cover", () => {
  it("landscape frame in a portrait container: guide square maps inside the frame", () => {
    // cover scale = max(500/2000, 1000/1000) = 1; displayed 2000×1000;
    // 750px cropped offscreen each side; guide = 500px square centered
    // (x offset 0, y offset 250) → video coords (750, 250) size 500.
    expect(guideCaptureRect(2000, 1000, 500, 1000)).toEqual({ sx: 750, sy: 250, size: 500, out: 500 });
  });

  it("caps the output side at 2000 for high-res frames", () => {
    // scale = max(1000/8000, 1000/6000) = 1/6; guide 1000px → video size 6000
    // → output capped at eBay's 2000.
    const r = guideCaptureRect(8000, 6000, 1000, 1000);
    expect(r).toEqual({ sx: 1000, sy: 0, size: 6000, out: 2000 });
  });
});
