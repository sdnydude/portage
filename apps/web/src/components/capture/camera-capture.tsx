"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCamera } from "@/hooks/use-camera";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const { videoRef, canvasRef, isReady, error, start, stop, capture, switchCamera, zoom, maxZoom, zoomMode, setZoom, devices, activeDeviceId, selectDevice } = useCamera();
  const [isCapturing, setIsCapturing] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [shotCount, setShotCount] = useState(0);
  const [flash, setFlash] = useState(false);
  // Shutter-flash timer must be cancelled on unmount — a stray setTimeout
  // fires after teardown (vitest flags it as an unhandled error; in the app
  // it's a setState-after-unmount warning).
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

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

  // Pinch-to-zoom: two active pointers scale zoom by the ratio of the current
  // finger distance to the distance when the second finger landed.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);

  const pointerDistance = () => {
    const [a, b] = [...pointersRef.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 2) {
        pinchStartRef.current = { distance: pointerDistance(), zoom };
      }
    },
    [zoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchStartRef.current;
      if (pointersRef.current.size === 2 && pinch && pinch.distance > 0) {
        setZoom(pinch.zoom * (pointerDistance() / pinch.distance));
      }
    },
    [setZoom],
  );

  const handlePointerEnd = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
  }, []);

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

  // Multi-shot: the stream stays ALIVE between shots. Stopping + re-requesting
  // getUserMedia per photo is what made iOS/macOS Safari re-prompt for camera
  // permission (and show the access banner) on every 2nd+ photo. One session,
  // many shutters; Done (or ✕ / unmount) releases the camera exactly once.
  const handleCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    const blob = await capture(
      viewport.width > 0 && viewport.height > 0 ? viewport : undefined,
    );
    if (blob) {
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      setShotCount((n) => n + 1);
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 150);
      onCapture(file);
    }
    setIsCapturing(false);
  }, [capture, onCapture, isCapturing, viewport]);

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Viewfinder */}
      <div
        ref={viewfinderRef}
        data-testid="viewfinder"
        className="flex-1 relative overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          // Digital zoom preview: scale the video so the viewfinder shows the
          // region capture() will crop. Native zoom arrives already zoomed.
          style={zoomMode === "digital" && zoom > 1 ? { transform: `scale(${zoom})` } : undefined}
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

        {flash && <div className="absolute inset-0 bg-white/70 pointer-events-none" aria-hidden />}

        {/* Zoom chips */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {[1, 2, 3]
            .filter((level) => level <= maxZoom)
            .map((level) => (
              <button
                key={level}
                onClick={() => setZoom(level)}
                aria-label={`Zoom ${level}×`}
                className={`min-w-10 h-10 px-2 rounded-full backdrop-blur-sm text-sm font-semibold transition-colors ${
                  Math.round(zoom) === level ? "bg-white text-black" : "bg-black/40 text-white"
                }`}
              >
                {level}×
              </button>
            ))}
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

        {/* Device picker — only when the browser sees several cameras (desktop
            with a Continuity Camera iPhone, external webcams). Mobile's two
            facings stay on the switch button. */}
        {devices.length > 1 && (
          <button
            onClick={() => setShowDevicePicker((v) => !v)}
            aria-label="Choose camera"
            className="absolute top-4 right-16 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        )}
        {showDevicePicker && (
          <div className="absolute top-16 right-4 z-10 rounded-2xl bg-black/70 backdrop-blur-md p-2 flex flex-col gap-1 max-w-[80vw]">
            {devices.map((d, i) => (
              <button
                key={d.deviceId}
                onClick={() => {
                  setShowDevicePicker(false);
                  selectDevice(d.deviceId);
                }}
                className={`px-4 py-2 rounded-xl text-left text-sm truncate ${
                  d.deviceId === activeDeviceId ? "bg-white text-black" : "text-white"
                }`}
              >
                {d.label || `Camera ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black px-6 py-8 grid grid-cols-3 items-center"
        style={{ paddingBottom: "calc(2rem + var(--safe-area-bottom))" }}
      >
        <div />
        <button
          onClick={handleCapture}
          disabled={!isReady || isCapturing}
          aria-label="Capture photo"
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95 justify-self-center"
        >
          <div className={`w-16 h-16 rounded-full ${isCapturing ? "bg-red-500" : "bg-white"} transition-colors`} />
        </button>
        <button
          onClick={handleClose}
          aria-label={`Done — ${shotCount} photo${shotCount === 1 ? "" : "s"}`}
          className="justify-self-end relative w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "var(--teal, #1A7A6D)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {shotCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center">
              {shotCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
