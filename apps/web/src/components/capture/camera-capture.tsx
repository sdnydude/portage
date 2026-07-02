"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCamera } from "@/hooks/use-camera";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const { videoRef, canvasRef, isReady, error, start, stop, capture, switchCamera } = useCamera();
  const [isCapturing, setIsCapturing] = useState(false);

  // One measurement drives BOTH the on-screen guide square and the capture
  // crop mapping (guideCaptureRect) — they can never disagree.
  const viewfinderRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = viewfinderRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setViewport({ width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const guideSide = Math.min(viewport.width, viewport.height);

  useEffect(() => {
    start();
    return () => { stop(); };
  }, [start, stop]);

  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
    },
    [videoRef],
  );

  const handleCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    const blob = await capture(
      viewport.width > 0 && viewport.height > 0 ? viewport : undefined,
    );
    if (blob) {
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      stop();
      onCapture(file);
    }
    setIsCapturing(false);
  }, [capture, stop, onCapture, isCapturing, viewport]);

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Viewfinder */}
      <div ref={viewfinderRef} className="flex-1 relative overflow-hidden">
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 1:1 capture guide: the largest centered square in the viewfinder.
            capture() maps exactly this region to the photo (guideCaptureRect),
            so what's inside the frame is what lands on eBay — square, ≤2000px.
            Sized from the measured viewport (never CSS aspect-ratio — iOS
            WebKit collapses it inside flex+overflow); the box-shadow dims
            everything outside the square. */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
          <div
            data-testid="square-guide"
            className="relative"
            style={{
              width: guideSide > 0 ? `${guideSide}px` : "100%",
              height: guideSide > 0 ? `${guideSide}px` : "100%",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          >
            {/* Corner ticks */}
            {[
              { top: 0, left: 0, borderWidth: "2px 0 0 2px" },
              { top: 0, right: 0, borderWidth: "2px 2px 0 0" },
              { bottom: 0, left: 0, borderWidth: "0 0 2px 2px" },
              { bottom: 0, right: 0, borderWidth: "0 2px 2px 0" },
            ].map((pos, i) => (
              <span
                key={i}
                className="absolute w-6 h-6 border-white/90"
                style={{ ...pos, borderStyle: "solid", borderColor: "rgba(255,255,255,0.9)" }}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <div className="text-center">
              <p className="text-white text-lg mb-2">Camera unavailable</p>
              <p className="text-white/60 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Switch camera */}
        <button
          onClick={switchCamera}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5M8 21H3v-5" />
            <path d="M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="bg-black px-6 py-8 flex items-center justify-center"
        style={{ paddingBottom: "calc(2rem + var(--safe-area-bottom))" }}
      >
        <button
          onClick={handleCapture}
          disabled={!isReady || isCapturing}
          aria-label="Capture photo"
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
        >
          <div className={`w-16 h-16 rounded-full ${isCapturing ? "bg-red-500" : "bg-white"} transition-colors`} />
        </button>
      </div>
    </div>
  );
}
