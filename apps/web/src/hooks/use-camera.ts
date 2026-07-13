"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { squareCaptureRect, guideCaptureRect, applyZoom } from "@/lib/square-capture";

// Track zoom is not in the standard TS lib DOM types yet.
interface ZoomCapability {
  min?: number;
  max?: number;
}

const DIGITAL_MAX_ZOOM = 3;
const DEVICE_STORAGE_KEY = "portage_camera_device";

const storedDeviceId = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    return null;
  }
};

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
  /** Current zoom factor (1 = no zoom). */
  zoom: number;
  /** Upper zoom bound — hardware max when native, 3x when digital. */
  maxZoom: number;
  /** "native" = sensor zoom via applyConstraints; "digital" = CSS scale + crop. Null until the stream starts. */
  zoomMode: "native" | "digital" | null;
  setZoom: (zoom: number) => void;
  /** Video inputs visible to the browser (Continuity Camera iPhones included). Populated after start(). */
  devices: CameraDevice[];
  /** Explicitly pinned camera, null when following facingMode. */
  activeDeviceId: string | null;
  /** Pin the stream to a specific camera (e.g. Continuity Camera iPhone). */
  selectDevice: (deviceId: string) => Promise<void>;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode = "environment", width = 2048, height = 2048 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef(facingMode);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [maxZoom, setMaxZoom] = useState(DIGITAL_MAX_ZOOM);
  const [zoomMode, setZoomMode] = useState<"native" | "digital" | null>(null);
  // Track with native zoom support — setZoom applies constraints to it.
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(() => storedDeviceId());
  const deviceIdRef = useRef<string | null>(activeDeviceId);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices?.() ?? [];
      setDevices(
        all
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label })),
      );
    } catch {
      // Device list is an enhancement — the active stream keeps working.
    }
  }, []);

  // Cameras come and go while the viewfinder is open — a Continuity Camera
  // iPhone only surfaces once it's locked/landscape/still. Track the browser's
  // devicechange signal so the picker reflects reality live.
  useEffect(() => {
    const md = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => { void refreshDevices(); };
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);

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
      // Pinned device wins; otherwise follow the facing preference. deviceId
      // and facingMode must not be combined — an exact deviceId on a desktop
      // camera has no meaningful facing and would overconstrain.
      const video: MediaTrackConstraints = deviceIdRef.current
        ? { deviceId: { exact: deviceIdRef.current } }
        : { facingMode: facingRef.current };
      video.width = { ideal: width };
      video.height = { ideal: height };
      // Chrome gates hardware pan-tilt-zoom behind an explicit request in the
      // constraints; browsers that don't know the key ignore it (spec-safe).
      (video as MediaTrackConstraints & { zoom?: boolean }).zoom = true;
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (err) {
        // Remembered device unplugged/out of range (e.g. Continuity Camera
        // iPhone left the desk): unpin and retry with the facing preference.
        if (!deviceIdRef.current) throw err;
        deviceIdRef.current = null;
        setActiveDeviceId(null);
        window.localStorage.removeItem(DEVICE_STORAGE_KEY);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingRef.current, width: { ideal: width }, height: { ideal: height } },
          audio: false,
        });
      }

      streamRef.current = mediaStream;

      // Detect hardware zoom support: tracks exposing a zoom capability get
      // native sensor zoom; everything else falls back to digital (CSS scale
      // in the viewfinder + tighter capture crop).
      const track = mediaStream.getTracks()[0];
      const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: ZoomCapability }) | undefined;
      if (capabilities?.zoom) {
        trackRef.current = track;
        setZoomMode("native");
        setMaxZoom(capabilities.zoom.max ?? DIGITAL_MAX_ZOOM);
      } else {
        trackRef.current = null;
        setZoomMode("digital");
        setMaxZoom(DIGITAL_MAX_ZOOM);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        try {
          await videoRef.current.play();
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          throw e;
        }

        setIsReady(true);

        // Enumerate AFTER the permission grant — labels are empty before it.
        // Continuity Camera iPhones show up here as ordinary videoinputs.
        await refreshDevices();
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
    const baseRect = container
      ? guideCaptureRect(video.videoWidth, video.videoHeight, container.width, container.height)
      : squareCaptureRect(video.videoWidth, video.videoHeight);
    // Native zoom already zooms the frames themselves; digital zoom tightens
    // the crop to match the CSS-scaled viewfinder.
    const { sx, sy, size, out } = zoomMode === "digital" ? applyZoom(baseRect, zoom) : baseRect;
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, sx, sy, size, size, 0, 0, out, out);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [zoom, zoomMode]);

  const switchCamera = useCallback(async () => {
    stop();
    deviceIdRef.current = null;
    setActiveDeviceId(null);
    facingRef.current = facingRef.current === "environment" ? "user" : "environment";
    setZoomState(1);
    await start();
  }, [stop, start]);

  const selectDevice = useCallback(async (deviceId: string) => {
    stop();
    deviceIdRef.current = deviceId;
    setActiveDeviceId(deviceId);
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    } catch {
      // Private mode etc. — selection still applies for this session.
    }
    setZoomState(1);
    await start();
  }, [stop, start]);

  const setZoom = useCallback((z: number) => {
    const clamped = Math.min(Math.max(z, 1), maxZoom);
    setZoomState(clamped);
    // Native zoom: hand the factor to the sensor. Fire-and-forget — a failed
    // constraint just leaves the previous zoom level.
    trackRef.current
      ?.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] })
      .catch(() => {});
  }, [maxZoom]);

  return { videoRef, canvasRef, isReady, error, start, stop, capture, switchCamera, zoom, maxZoom, zoomMode, setZoom, devices, activeDeviceId, selectDevice };
}
