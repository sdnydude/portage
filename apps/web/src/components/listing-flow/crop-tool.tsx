"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { displayScale, clampOffset, rescaleOffset, cropRegionFromView, type CropRegion } from "@/lib/pan-zoom-crop";

interface CropToolProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  onApply: (crop: CropRegion) => void;
  onCancel: () => void;
}

const MAX_ZOOM = 5;

/**
 * Stationary 1:1 crop window; the IMAGE moves — drag to position, pinch or
 * scroll to zoom (Instagram-style). Replaces the corner-handle box: the user
 * controls the photo, not the frame, and the output is always square (eBay
 * photo discipline). Emits the same image-coordinate CropRegion contract.
 */
export function CropTool({ imageUrl, imageWidth, imageHeight, onApply, onCancel }: CropToolProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [windowSide, setWindowSide] = useState(0);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Measure the stage; the crop window is its largest centered square.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setWindowSide(Math.min(r.width, r.height));
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const scale = windowSide > 0 ? displayScale({ imageWidth, imageHeight, windowSide, zoom }) : 0;

  // Center the image whenever the window size is (re)measured.
  useEffect(() => {
    if (windowSide === 0) return;
    const s = displayScale({ imageWidth, imageHeight, windowSide, zoom: 1 });
    setZoom(1);
    setOffset({ x: (windowSide - imageWidth * s) / 2, y: (windowSide - imageHeight * s) / 2 });
  }, [windowSide, imageWidth, imageHeight]);

  const clamp = useCallback((o: { x: number; y: number }, z: number) => {
    const s = displayScale({ imageWidth, imageHeight, windowSide, zoom: z });
    return {
      x: clampOffset(o.x, imageWidth * s, windowSide),
      y: clampOffset(o.y, imageHeight * s, windowSide),
    };
  }, [imageWidth, imageHeight, windowSide]);

  // ── Pointer pan + two-finger pinch ────────────────────────────────────────
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointersRef.current.set(e.pointerId, next);

    if (pointersRef.current.size === 2 && pinchDistRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / pinchDistRef.current;
      pinchDistRef.current = dist;
      setZoom((z) => {
        const nz = Math.min(MAX_ZOOM, Math.max(1, z * ratio));
        const r = nz / z;
        const rect = stageRef.current?.getBoundingClientRect();
        const cx = rect ? (a.x + b.x) / 2 - rect.left - (rect.width - windowSide) / 2 : windowSide / 2;
        const cy = rect ? (a.y + b.y) / 2 - rect.top - (rect.height - windowSide) / 2 : windowSide / 2;
        setOffset((o) => clamp({ x: rescaleOffset(o.x, cx, r), y: rescaleOffset(o.y, cy, r) }, nz));
        return nz;
      });
    } else if (pointersRef.current.size === 1) {
      setOffset((o) => clamp({ x: o.x + (next.x - prev.x), y: o.y + (next.y - prev.y) }, zoom));
    }
  }, [clamp, zoom, windowSide]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchDistRef.current = null;
  }, []);

  // Desktop: wheel zooms, anchored at the cursor.
  const onWheel = useCallback((e: React.WheelEvent) => {
    setZoom((z) => {
      const nz = Math.min(MAX_ZOOM, Math.max(1, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      const r = nz / z;
      const rect = stageRef.current?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left - (rect.width - windowSide) / 2 : windowSide / 2;
      const cy = rect ? e.clientY - rect.top - (rect.height - windowSide) / 2 : windowSide / 2;
      setOffset((o) => clamp({ x: rescaleOffset(o.x, cx, r), y: rescaleOffset(o.y, cy, r) }, nz));
      return nz;
    });
  }, [clamp, windowSide]);

  const handleApply = useCallback(() => {
    if (windowSide === 0) return;
    onApply(cropRegionFromView({ imageWidth, imageHeight, windowSide, zoom, offsetX: offset.x, offsetY: offset.y }));
  }, [onApply, imageWidth, imageHeight, windowSide, zoom, offset]);

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: "calc(0.75rem + var(--safe-area-top, 0px))" }}>
        <button onClick={onCancel} className="text-white text-base font-medium">Cancel</button>
        <span className="text-xs text-white/50">Drag to position · pinch to zoom</span>
        <button
          onClick={handleApply}
          className="text-white text-base font-semibold px-4 py-1.5 rounded-lg"
          style={{ background: "var(--teal, #1A7A6D)" }}
        >
          Apply
        </button>
      </div>

      {/* Stage: stationary square window; the image pans/zooms underneath */}
      <div
        ref={stageRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {windowSide > 0 && (
          <div
            data-testid="crop-window"
            className="relative overflow-hidden"
            style={{ width: windowSide, height: windowSide, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Crop"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: imageWidth * scale,
                height: imageHeight * scale,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                transformOrigin: "0 0",
              }}
            />
            {/* Rule-of-thirds grid */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              {[1, 2].map((i) => (
                <span key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${(i * 100) / 3}%` }} />
              ))}
              {[1, 2].map((i) => (
                <span key={`h${i}`} className="absolute left-0 right-0 h-px bg-white/25" style={{ top: `${(i * 100) / 3}%` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 text-center" style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom, 0px))" }}>
        <span className="text-xs text-white/40">Square crop · matches eBay&apos;s 1:1 listing photos</span>
      </div>
    </div>
  );
}
