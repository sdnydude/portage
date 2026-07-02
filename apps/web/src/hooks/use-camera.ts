"use client";

import { useRef, useState, useCallback } from "react";
import { squareCaptureRect, guideCaptureRect } from "@/lib/square-capture";

interface UseCameraOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  capture: (container?: { width: number; height: number }) => Promise<Blob | null>;
  switchCamera: () => Promise<void>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode = "environment", width = 2048, height = 2048 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef(facingMode);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsReady(false);
    }
  }, []);

  const start = useCallback(async () => {
    stop();
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingRef.current,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        try {
          await videoRef.current.play();
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          throw e;
        }

        setIsReady(true);
      } else {
        mediaStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera access denied";
      setError(message);
      setIsReady(false);
    }
  }, [stop, width, height]);

  const capture = useCallback(async (container?: { width: number; height: number }): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return null;

    // Square discipline: capture the 1:1 region the viewfinder guide frames,
    // capped at eBay's 2000×2000 photo maximum. With the viewport dimensions
    // the crop matches the on-screen guide exactly (object-cover mapping);
    // without them it falls back to the frame's centered square.
    const { sx, sy, size, out } = container
      ? guideCaptureRect(video.videoWidth, video.videoHeight, container.width, container.height)
      : squareCaptureRect(video.videoWidth, video.videoHeight);
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, sx, sy, size, size, 0, 0, out, out);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, []);

  const switchCamera = useCallback(async () => {
    stop();
    facingRef.current = facingRef.current === "environment" ? "user" : "environment";
    await start();
  }, [stop, start]);

  return { videoRef, canvasRef, isReady, error, start, stop, capture, switchCamera };
}
