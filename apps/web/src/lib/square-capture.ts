// eBay listing photos are square-disciplined: capture crops the centered 1:1
// region of the camera frame, downscaled to eBay's 2000×2000 maximum.
export const EBAY_MAX_PHOTO_PX = 2000;

export interface SquareCaptureRect {
  /** Source crop origin within the frame. */
  sx: number;
  sy: number;
  /** Source crop side length (min of frame dimensions). */
  size: number;
  /** Output canvas side length (≤ EBAY_MAX_PHOTO_PX). */
  out: number;
}

/**
 * Maps the viewfinder's on-screen guide square (full-width/height centered
 * square in a `containerW × containerH` viewport showing the frame with
 * CSS object-cover) back to source-frame coordinates, so what the guide
 * frames is exactly what capture() crops.
 */
export function guideCaptureRect(
  frameWidth: number,
  frameHeight: number,
  containerW: number,
  containerH: number,
): SquareCaptureRect {
  const scale = Math.max(containerW / frameWidth, containerH / frameHeight);
  // Offscreen crop introduced by object-cover, in displayed px.
  const offX = (frameWidth * scale - containerW) / 2;
  const offY = (frameHeight * scale - containerH) / 2;
  // Guide square: largest centered square that fits the viewport.
  const guide = Math.min(containerW, containerH);
  const gx = (containerW - guide) / 2;
  const gy = (containerH - guide) / 2;

  const size = Math.round(guide / scale);
  return {
    sx: Math.round((offX + gx) / scale),
    sy: Math.round((offY + gy) / scale),
    size,
    out: Math.min(size, EBAY_MAX_PHOTO_PX),
  };
}

export function squareCaptureRect(frameWidth: number, frameHeight: number): SquareCaptureRect {
  const size = Math.min(frameWidth, frameHeight);
  return {
    sx: Math.floor((frameWidth - size) / 2),
    sy: Math.floor((frameHeight - size) / 2),
    size,
    out: Math.min(size, EBAY_MAX_PHOTO_PX),
  };
}
