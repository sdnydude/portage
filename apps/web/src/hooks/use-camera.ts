"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseCameraOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  stream: MediaStream | null;
  isReady: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Promise<Blob | null>;
  switchCamera: () => Promise<void>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode = "environment", width = 2048, height = 2048 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFacing, setCurrentFacing] = useState(facingMode);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsReady(false);
    }
  }, [stream]);

  const start = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacing,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setIsReady(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera access denied";
      setError(message);
      setIsReady(false);
    }
  }, [currentFacing, width, height]);

  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isReady) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [isReady]);

  const switchCamera = useCallback(async () => {
    stop();
    setCurrentFacing((prev) => (prev === "environment" ? "user" : "environment"));
  }, [stop]);

  useEffect(() => {
    if (currentFacing && !stream) {
      // Auto-restart after camera switch
    }
  }, [currentFacing, stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  return { videoRef, canvasRef, stream, isReady, error, start, stop, capture, switchCamera };
}
