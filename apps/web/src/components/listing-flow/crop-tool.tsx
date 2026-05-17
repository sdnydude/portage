"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type AspectRatio = "free" | "1:1" | "4:3" | "3:4";

interface CropToolProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  onApply: (crop: CropRegion) => void;
  onCancel: () => void;
}

export function CropTool({ imageUrl, imageWidth, imageHeight, onApply, onCancel }: CropToolProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<AspectRatio>("free");
  const [crop, setCrop] = useState<CropRegion>(() => ({
    x: imageWidth * 0.1,
    y: imageHeight * 0.1,
    width: imageWidth * 0.8,
    height: imageHeight * 0.8,
  }));
  const [dragging, setDragging] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, crop: crop });
  const [displayScale, setDisplayScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scaleX = rect.width / imageWidth;
      const scaleY = rect.height / imageHeight;
      setDisplayScale(Math.min(scaleX, scaleY, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageWidth, imageHeight]);

  const applyAspectConstraint = useCallback((region: CropRegion, ratio: AspectRatio): CropRegion => {
    if (ratio === "free") return region;
    const [w, h] = ratio === "1:1" ? [1, 1] : ratio === "4:3" ? [4, 3] : [3, 4];
    const targetRatio = w / h;
    let newW = region.width;
    let newH = region.width / targetRatio;
    if (newH > imageHeight) {
      newH = region.height;
      newW = region.height * targetRatio;
    }
    return {
      x: Math.max(0, Math.min(region.x, imageWidth - newW)),
      y: Math.max(0, Math.min(region.y, imageHeight - newH)),
      width: Math.min(newW, imageWidth),
      height: Math.min(newH, imageHeight),
    };
  }, [imageWidth, imageHeight]);

  const handlePointerDown = useCallback((e: React.PointerEvent, handle: typeof dragging) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(handle);
    dragStart.current = { mx: e.clientX, my: e.clientY, crop: { ...crop } };
  }, [crop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.current.mx) / displayScale;
    const dy = (e.clientY - dragStart.current.my) / displayScale;
    const prev = dragStart.current.crop;

    let next: CropRegion;

    if (dragging === "move") {
      next = {
        ...prev,
        x: Math.max(0, Math.min(prev.x + dx, imageWidth - prev.width)),
        y: Math.max(0, Math.min(prev.y + dy, imageHeight - prev.height)),
      };
    } else {
      const isLeft = dragging.includes("w");
      const isTop = dragging.includes("n");
      let newX = isLeft ? prev.x + dx : prev.x;
      let newY = isTop ? prev.y + dy : prev.y;
      let newW = isLeft ? prev.width - dx : prev.width + dx;
      let newH = isTop ? prev.height - dy : prev.height + dy;

      newW = Math.max(50, newW);
      newH = Math.max(50, newH);
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      if (newX + newW > imageWidth) newW = imageWidth - newX;
      if (newY + newH > imageHeight) newH = imageHeight - newY;

      next = { x: newX, y: newY, width: newW, height: newH };
    }

    setCrop(applyAspectConstraint(next, aspect));
  }, [dragging, displayScale, imageWidth, imageHeight, aspect, applyAspectConstraint]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleAspectChange = useCallback((ratio: AspectRatio) => {
    setAspect(ratio);
    setCrop(prev => applyAspectConstraint(prev, ratio));
  }, [applyAspectConstraint]);

  const s = displayScale;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: "calc(0.75rem + var(--safe-area-top, 0px))" }}>
        <button onClick={onCancel} className="text-white text-base font-medium">Cancel</button>
        <button
          onClick={() => onApply({ x: Math.round(crop.x), y: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) })}
          className="text-white text-base font-semibold px-4 py-1.5 rounded-lg"
          style={{ background: "var(--flow-accent, #2D5A27)" }}
        >
          Apply
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="relative" style={{ width: imageWidth * s, height: imageHeight * s }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Crop" className="w-full h-full select-none" draggable={false} />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bg-black/60" style={{ left: 0, top: 0, width: "100%", height: crop.y * s }} />
            <div className="absolute bg-black/60" style={{ left: 0, top: (crop.y + crop.height) * s, width: "100%", bottom: 0 }} />
            <div className="absolute bg-black/60" style={{ left: 0, top: crop.y * s, width: crop.x * s, height: crop.height * s }} />
            <div className="absolute bg-black/60" style={{ left: (crop.x + crop.width) * s, top: crop.y * s, right: 0, height: crop.height * s }} />
          </div>

          <div
            className="absolute border-2 border-white cursor-move"
            style={{ left: crop.x * s, top: crop.y * s, width: crop.width * s, height: crop.height * s }}
            onPointerDown={(e) => handlePointerDown(e, "move")}
          >
            {(["nw", "ne", "sw", "se"] as const).map(corner => (
              <div
                key={corner}
                className="absolute w-5 h-5 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{
                  left: corner.includes("e") ? "100%" : 0,
                  top: corner.includes("s") ? "100%" : 0,
                }}
                onPointerDown={(e) => handlePointerDown(e, corner)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center py-4 px-4" style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom, 0px))" }}>
        {(["free", "1:1", "4:3", "3:4"] as const).map(ratio => (
          <button
            key={ratio}
            onClick={() => handleAspectChange(ratio)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: aspect === ratio ? "var(--flow-accent, #2D5A27)" : "rgba(255,255,255,0.15)",
              color: "white",
            }}
          >
            {ratio === "free" ? "Free" : ratio}
          </button>
        ))}
      </div>
    </div>
  );
}
