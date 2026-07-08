"use client";

import { useState } from "react";

interface ExposureToolProps {
  imageUrl: string;
  onApply: (ev: number) => void;
  onCancel: () => void;
}

/**
 * Exposure compensation (EV) tool. iOS Safari exposes no camera-level EVC via
 * getUserMedia, so underexposed shots are corrected post-capture instead: the
 * slider previews instantly via CSS brightness(2^ev) and Apply bakes the same
 * multiplier server-side (Sharp modulate) — preview and saved file match.
 */
export function ExposureTool({ imageUrl, onApply, onCancel }: ExposureToolProps) {
  const [ev, setEv] = useState(0);

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: "calc(0.75rem + var(--safe-area-top, 0px))" }}>
        <button onClick={onCancel} className="text-white text-base font-medium">Cancel</button>
        <span className="text-xs text-white/50">Exposure</span>
        <button
          onClick={() => onApply(ev)}
          className="text-white text-base font-semibold px-4 py-1.5 rounded-lg"
          style={{ background: "var(--teal, #1A7A6D)" }}
        >
          Apply
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Exposure preview"
          draggable={false}
          className="max-w-full max-h-full select-none"
          style={{ filter: `brightness(${2 ** ev})` }}
        />
      </div>

      <div className="px-4 pb-4 space-y-2" style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom, 0px))" }}>
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>−2 EV</span>
          <span className="font-mono text-white">{ev > 0 ? `+${ev}` : `${ev}`} EV</span>
          <span>+2 EV</span>
        </div>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.25}
          value={ev}
          onChange={(e) => setEv(Number(e.target.value))}
          className="w-full accent-[var(--teal,#1A7A6D)]"
          aria-label="Exposure compensation"
        />
      </div>
    </div>
  );
}
