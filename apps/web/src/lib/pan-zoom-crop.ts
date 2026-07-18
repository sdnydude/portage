// Pan/zoom crop model: a STATIONARY 1:1 window; the image moves under it.
// The window always stays fully covered by the image (cover-fit minimum zoom,
// clamped pan), so the emitted CropRegion is always valid image coordinates.

export interface PanZoomView {
  imageWidth: number;
  imageHeight: number;
  /** Square crop window side, display px. */
  windowSide: number;
  /** User zoom ≥ 1 (1 = image cover-fits the window). */
  zoom: number;
  /** Image top-left relative to the window top-left, display px (≤ 0). */
  offsetX: number;
  offsetY: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Display scale: image px → screen px. zoom 1 covers the window exactly. */
export function displayScale(v: Pick<PanZoomView, "imageWidth" | "imageHeight" | "windowSide" | "zoom">): number {
  return (v.windowSide / Math.min(v.imageWidth, v.imageHeight)) * v.zoom;
}

/** Clamp a pan offset so the image keeps covering the window on that axis. */
export function clampOffset(offset: number, imageSideDisplayPx: number, windowSide: number): number {
  return Math.min(0, Math.max(windowSide - imageSideDisplayPx, offset));
}

/**
 * Rescale a pan offset through a zoom change so the image point under
 * `anchor` (display px within the window) stays stationary.
 * `ratio` = newScale / oldScale.
 */
export function rescaleOffset(offset: number, anchor: number, ratio: number): number {
  return anchor - (anchor - offset) * ratio;
}

export function cropRegionFromView(v: PanZoomView): CropRegion {
  const s = displayScale(v);
  const ox = clampOffset(v.offsetX, v.imageWidth * s, v.windowSide);
  const oy = clampOffset(v.offsetY, v.imageHeight * s, v.windowSide);
  const side = v.windowSide / s;
  return {
    // `+ 0` normalizes the -0 that Math.round(-0/s) produces.
    x: Math.round(-ox / s) + 0,
    y: Math.round(-oy / s) + 0,
    width: Math.round(side),
    height: Math.round(side),
  };
}
