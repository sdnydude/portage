"use client";

import { useState, useCallback, useRef } from "react";
import { useCamera } from "@/hooks/use-camera";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const { videoRef, canvasRef, isReady, error, start, stop, capture, switchCamera } = useCamera();
  const [isCapturing, setIsCapturing] = useState(false);
  const started = useRef(false);

  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && !started.current) {
        started.current = true;
        start();
      }
    },
    [videoRef, start],
  );

  const handleCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    const blob = await capture();
    if (blob) {
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      stop();
      onCapture(file);
    }
    setIsCapturing(false);
  }, [capture, stop, onCapture, isCapturing]);

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

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
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
        >
          <div className={`w-16 h-16 rounded-full ${isCapturing ? "bg-red-500" : "bg-white"} transition-colors`} />
        </button>
      </div>
    </div>
  );
}
