"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ReviewComments } from "@/components/review-comments";
import { DevSteps } from "@/components/dev-steps";

interface Photo {
  id: string;
  src: string;
  original: string;
  enhanced: boolean;
  bgRemoved: boolean;
}

type View = "grid" | "camera" | "crop" | "enhance" | "listing";

interface CropRegion {
  x: number; // 0-1 percentage
  y: number;
  width: number;
  height: number;
}

type DragHandle = "tl" | "tr" | "bl" | "br" | "move" | null;

interface DragState {
  handle: DragHandle;
  startX: number;
  startY: number;
  startRegion: CropRegion;
}

interface WalkthroughStep {
  title: string;
  description: string;
  action: string;
  position: "top" | "center" | "bottom";
}

const WALKTHROUGH: WalkthroughStep[] = [
  { title: "Photo Capture Flow", description: "Live camera with crop, AI enhancement, background removal, and 12-photo gallery. This is a working prototype — try it!", action: "Tap anywhere to begin", position: "center" },
  { title: "Step 1: Photo grid", description: "Your photo gallery with slots for up to 12 images. First photo is the hero. Tap the camera button to capture.", action: "Tap the camera button", position: "center" },
  { title: "Step 2: Live camera", description: "Real camera viewfinder with rule-of-thirds grid. Switch front/back. Tap shutter to capture.", action: "Tap the shutter button", position: "bottom" },
  { title: "Step 3: Crop & rotate", description: "Crop your photo with aspect ratio presets. Drag corners to adjust framing.", action: "Tap 'Apply' to accept", position: "center" },
  { title: "Step 4: AI enhance & BG removal", description: "AI improves lighting and color. Background removal creates clean product shots. Both are live and functional.", action: "Tap 'Apply' to keep", position: "center" },
  { title: "Step 5: Create listing", description: "Review your photos and create a listing. AI auto-generates title, description, and pricing from your photos.", action: "Walkthrough complete", position: "center" },
];

export default function CameraMockup() {
  const [view, setView] = useState<View>("grid");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [wtStep, setWtStep] = useState(0);
  const [cropRatio, setCropRatio] = useState<"square" | "4:3" | "free">("square");
  const [enhanceOn, setEnhanceOn] = useState(true);
  const [showBefore, setShowBefore] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [processingAi, setProcessingAi] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [capturedImage, _setCapturedImage] = useState<string | null>(null);
  const [capturedOriginal, setCapturedOriginal] = useState<string | null>(null);

  const setCapturedImage = useCallback((next: string | null) => {
    _setCapturedImage(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return next;
    });
  }, []);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [, setListingPanel] = useState(false);

  const [cropRegion, setCropRegion] = useState<CropRegion>({ x: 0, y: 0, width: 1, height: 1 });
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<"environment" | "user">("environment");
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const currentWt = WALKTHROUGH[wtStep];
  const isLastWt = wtStep >= WALKTHROUGH.length - 1;

  // Compute initial crop region centered, max size, respecting aspect ratio
  const computeInitialCrop = useCallback((ratio: "square" | "4:3" | "free", imgW: number, imgH: number): CropRegion => {
    if (ratio === "free") return { x: 0, y: 0, width: 1, height: 1 };
    const targetRatio = ratio === "square" ? 1 : 4 / 3;
    const imgRatio = imgW / imgH;
    let w: number, h: number;
    if (imgRatio > targetRatio) {
      // image is wider than target: height-limited
      h = 1;
      w = (targetRatio / imgRatio);
    } else {
      // image is taller than target: width-limited
      w = 1;
      h = (imgRatio / targetRatio);
    }
    return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
  }, []);

  // Recalculate crop when ratio changes
  useEffect(() => {
    if (view === "crop" && imageNaturalSize) {
      setCropRegion(computeInitialCrop(cropRatio, imageNaturalSize.w, imageNaturalSize.h));
    }
  }, [cropRatio, view, imageNaturalSize, computeInitialCrop]);

  // Load natural image size when entering crop view
  useEffect(() => {
    if (view === "crop" && capturedImage) {
      const img = new Image();
      img.onload = () => {
        setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        setCropRegion(computeInitialCrop(cropRatio, img.naturalWidth, img.naturalHeight));
      };
      img.src = capturedImage;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, capturedImage]);

  const cropLabel = useMemo(() => {
    if (!imageNaturalSize) return "";
    const pw = Math.round(cropRegion.width * imageNaturalSize.w);
    const ph = Math.round(cropRegion.height * imageNaturalSize.h);
    return `${pw} x ${ph}`;
  }, [cropRegion, imageNaturalSize]);

  const MIN_CROP = 0.1; // Minimum crop dimension as fraction

  const clampRegion = useCallback((r: CropRegion, ratio: "square" | "4:3" | "free", imgW: number, imgH: number): CropRegion => {
    let { x, y, width, height } = r;

    // Enforce minimum size
    width = Math.max(width, MIN_CROP);
    height = Math.max(height, MIN_CROP);

    // Enforce aspect ratio
    if (ratio !== "free") {
      const targetRatio = ratio === "square" ? 1 : 4 / 3;
      // Convert to pixel-proportional dimensions for ratio enforcement
      const cropPixelW = width * imgW;
      const cropPixelH = height * imgH;
      const currentRatio = cropPixelW / cropPixelH;
      if (Math.abs(currentRatio - targetRatio) > 0.01) {
        // Adjust height to match ratio
        const newPixelH = cropPixelW / targetRatio;
        height = newPixelH / imgH;
        if (height > 1) {
          height = 1;
          const newPixelW = height * imgH * targetRatio;
          width = newPixelW / imgW;
        }
      }
    }

    // Clamp to bounds
    width = Math.min(width, 1);
    height = Math.min(height, 1);
    x = Math.max(0, Math.min(x, 1 - width));
    y = Math.max(0, Math.min(y, 1 - height));

    return { x, y, width, height };
  }, []);

  const handleCropPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = cropContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0-1 position in container
    const py = (e.clientY - rect.top) / rect.height;

    const { x, y, width, height } = cropRegion;
    const handleSize = 30 / rect.width; // ~30px as fraction of container

    let handle: DragHandle = null;

    // Check corners first (larger hit targets)
    const nearTL = Math.abs(px - x) < handleSize && Math.abs(py - y) < handleSize;
    const nearTR = Math.abs(px - (x + width)) < handleSize && Math.abs(py - y) < handleSize;
    const nearBL = Math.abs(px - x) < handleSize && Math.abs(py - (y + height)) < handleSize;
    const nearBR = Math.abs(px - (x + width)) < handleSize && Math.abs(py - (y + height)) < handleSize;

    if (nearTL) handle = "tl";
    else if (nearTR) handle = "tr";
    else if (nearBL) handle = "bl";
    else if (nearBR) handle = "br";
    else if (px > x && px < x + width && py > y && py < y + height) handle = "move";

    if (!handle) return;

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      handle,
      startX: px,
      startY: py,
      startRegion: { ...cropRegion },
    };
  }, [cropRegion]);

  const handleCropPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = cropContainerRef.current;
    if (!drag || !container || !imageNaturalSize) return;

    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const dx = px - drag.startX;
    const dy = py - drag.startY;

    const s = drag.startRegion;
    let newRegion: CropRegion;

    if (drag.handle === "move") {
      newRegion = { x: s.x + dx, y: s.y + dy, width: s.width, height: s.height };
    } else {
      // Corner dragging
      let nx = s.x, ny = s.y, nw = s.width, nh = s.height;

      if (drag.handle === "tl") {
        nx = s.x + dx;
        ny = s.y + dy;
        nw = s.width - dx;
        nh = s.height - dy;
      } else if (drag.handle === "tr") {
        ny = s.y + dy;
        nw = s.width + dx;
        nh = s.height - dy;
      } else if (drag.handle === "bl") {
        nx = s.x + dx;
        nw = s.width - dx;
        nh = s.height + dy;
      } else if (drag.handle === "br") {
        nw = s.width + dx;
        nh = s.height + dy;
      }

      // Enforce aspect ratio while dragging
      if (cropRatio !== "free") {
        const targetRatio = cropRatio === "square" ? 1 : 4 / 3;
        // Determine aspect-correct dimensions
        const cropPixelW = nw * imageNaturalSize.w;
        const desiredPixelH = cropPixelW / targetRatio;
        const correctedH = desiredPixelH / imageNaturalSize.h;

        // Adjust based on which corner is being dragged
        if (drag.handle === "tl") {
          const hDiff = correctedH - nh;
          nh = correctedH;
          ny = ny - hDiff;
        } else if (drag.handle === "tr") {
          const hDiff = correctedH - nh;
          nh = correctedH;
          ny = ny - hDiff;
        } else if (drag.handle === "bl" || drag.handle === "br") {
          nh = correctedH;
        }

        // If ratio makes it too tall, adjust width instead
        if (nh > 1 || ny < 0) {
          const maxH = drag.handle === "tl" || drag.handle === "tr" ? s.y + s.height : 1 - s.y;
          nh = Math.min(nh, maxH);
          const correctedPixelW = nh * imageNaturalSize.h * targetRatio;
          nw = correctedPixelW / imageNaturalSize.w;
          if (drag.handle === "tl" || drag.handle === "tr") {
            ny = s.y + s.height - nh;
          }
          if (drag.handle === "tl" || drag.handle === "bl") {
            nx = s.x + s.width - nw;
          }
        }
      }

      newRegion = { x: nx, y: ny, width: nw, height: nh };
    }

    newRegion = clampRegion(newRegion, cropRatio, imageNaturalSize.w, imageNaturalSize.h);
    setCropRegion(newRegion);
  }, [cropRatio, imageNaturalSize, clampRegion]);

  const handleCropPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Camera access denied");
    }
  }, [stopCamera]);

  const switchCamera = useCallback(async () => {
    facingRef.current = facingRef.current === "environment" ? "user" : "environment";
    await startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (view === "camera") { startCamera(); }
    return () => { if (view === "camera") stopCamera(); };
  }, [view, startCamera, stopCamera]);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedImage(dataUrl);
    setCapturedOriginal(dataUrl);
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);
    stopCamera();
    setWtStep(3);
    setTimeout(() => setView("crop"), 300);
  }

  function handleCropApply() {
    if (!capturedImage) { setView("enhance"); return; }

    // First, crop the image using canvas
    const cropCanvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      const sx = Math.round(cropRegion.x * img.naturalWidth);
      const sy = Math.round(cropRegion.y * img.naturalHeight);
      const sw = Math.round(cropRegion.width * img.naturalWidth);
      const sh = Math.round(cropRegion.height * img.naturalHeight);
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      const ctx = cropCanvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const croppedDataUrl = cropCanvas.toDataURL("image/jpeg", 0.92);
      setCapturedImage(croppedDataUrl);
      setCapturedOriginal(croppedDataUrl);

      // Now transition to enhance view and apply AI enhancement
      setWtStep(4);
      setView("enhance");
      setBgRemoved(false);
      setProcessingAi(true);
      setTimeout(() => {
        const enhanceCanvas = document.createElement("canvas");
        const enhImg = new Image();
        enhImg.onload = () => {
          enhanceCanvas.width = enhImg.width;
          enhanceCanvas.height = enhImg.height;
          const ectx = enhanceCanvas.getContext("2d");
          if (ectx) {
            ectx.filter = "brightness(1.1) contrast(1.05) saturate(1.1)";
            ectx.drawImage(enhImg, 0, 0);
            setCapturedImage(enhanceCanvas.toDataURL("image/jpeg", 0.92));
          }
          setProcessingAi(false);
        };
        enhImg.src = croppedDataUrl;
      }, 800);
    };
    img.src = capturedImage;
  }

  async function handleRemoveBg() {
    if (!capturedImage || removingBg) return;
    setRemovingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const resp = await fetch(capturedImage);
      const blob = await resp.blob();
      const result = await removeBackground(blob, { output: { format: "image/png" } });
      const url = URL.createObjectURL(result);
      setCapturedImage(url);
      setBgRemoved(true);
    } catch {
      setBgRemoved(false);
    }
    setRemovingBg(false);
  }

  function handleEnhanceApply() {
    if (!capturedImage) return;
    const newPhoto: Photo = {
      id: `photo-${Date.now()}`,
      src: capturedImage,
      original: capturedOriginal || capturedImage,
      enhanced: enhanceOn,
      bgRemoved,
    };
    setPhotos((prev) => [...prev, newPhoto]);
    setCapturedImage(null);
    setCapturedOriginal(null);
    setBgRemoved(false);
    setView("grid");
    setWtStep(Math.min(5, WALKTHROUGH.length - 1));
  }

  function handleOpenCamera() {
    if (photos.length >= 12) return;
    setWtStep(2);
    setView("camera");
    setCapturedImage(null);
    setEnhanceOn(true);
    setShowBefore(false);
    setBgRemoved(false);
  }

  function handleDeletePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleRestart() {
    setPhotos([]);
    setView("grid");
    setWtStep(0);
    setCapturedImage(null);
    stopCamera();
  }

  function advanceWt() {
    if (wtStep === 0) setWtStep(1);
  }

  const photoSlots = Array.from({ length: 12 }, (_, i) => photos[i] || null);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F7F4] transition-colors duration-300" style={{ maxWidth: "430px", margin: "0 auto" }}>
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#E8E5DE] bg-[#F8F7F4]/95 backdrop-blur-xl z-20">
        <Link href="/mockups" className="text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <div className="w-9 h-9 rounded-full bg-[#F15A22] flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" fill="white" stroke="#F15A22" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-[15px] font-semibold text-[#1A1A1A] font-[family-name:var(--font-instrument)]">Item Photos</h1>
          <p className="text-[11px] text-[#0047AB]">{photos.length}/12 photos</p>
        </div>
        <span className="text-[9px] font-mono tracking-wider uppercase text-[#8A8A8A] border border-[#E8E5DE] bg-white/60 px-2 py-0.5 rounded-full">Live</span>
      </header>

      {/* ═══════ GRID VIEW ═══════ */}
      {view === "grid" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {photos.length > 0 && (
            <div className="relative mb-3 rounded-2xl overflow-hidden border border-[#E8E5DE] bg-white shadow-sm" style={{ aspectRatio: "4/3" }}>
              <img src={photos[0].src} alt="Hero" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                <span className="text-white text-[11px] font-medium">Hero photo</span>
              </div>
              <div className="absolute top-3 right-3 flex gap-1.5">
                {photos[0].enhanced && (
                  <span className="px-2 py-1 rounded-lg bg-[#0047AB]/80 backdrop-blur-sm text-white text-[10px] font-medium">AI Enhanced</span>
                )}
                {photos[0].bgRemoved && (
                  <span className="px-2 py-1 rounded-lg bg-[#F15A22]/80 backdrop-blur-sm text-white text-[10px] font-medium">BG Removed</span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {photoSlots.map((photo, i) => {
              if (i === 0 && photos.length > 0) return null;
              return photo ? (
                <div key={photo.id} className="relative rounded-xl overflow-hidden border border-[#E8E5DE] bg-white group" style={{ aspectRatio: "1" }}>
                  <img src={photo.src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  {photo.bgRemoved && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#F15A22]/80 text-white text-[8px] font-bold">BG</div>
                  )}
                  {photo.enhanced && (
                    <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-[#0047AB] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" /></svg>
                    </div>
                  )}
                  <button onClick={() => handleDeletePhoto(i)} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div key={`empty-${i}`} className="rounded-xl border-2 border-dashed border-[#E8E5DE] flex items-center justify-center" style={{ aspectRatio: "1" }}>
                  <span className="text-[#BCBCBC] text-[10px] font-mono">{i + 1}</span>
                </div>
              );
            })}
          </div>

          {photos.length < 12 && (
            <button onClick={handleOpenCamera} className="w-full mt-4 py-4 rounded-2xl border-2 border-dashed border-[#F15A22]/30 bg-[#F15A22]/5 text-[#F15A22] flex items-center justify-center gap-2 hover:bg-[#F15A22]/10 active:scale-[0.98] transition-all">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-[15px] font-medium">Take photo ({photos.length}/12)</span>
            </button>
          )}

          <div className="mt-4 rounded-xl border border-[#E8E5DE] bg-white px-4 py-3">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] mb-2">Tips</p>
            <ul className="space-y-1.5 text-[13px] text-[#6B6B6B]">
              <li className="flex items-start gap-2"><span className="text-[#F15A22] mt-0.5">●</span>First photo is the hero — make it count</li>
              <li className="flex items-start gap-2"><span className="text-[#0047AB] mt-0.5">●</span>Use BG removal for clean product shots</li>
              <li className="flex items-start gap-2"><span className="text-[#F15A22] mt-0.5">●</span>More photos = faster sales</li>
            </ul>
          </div>

          {photos.length > 0 && (
            <button onClick={() => { setView("listing"); setListingPanel(true); }} className="w-full mt-4 py-3.5 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium active:scale-[0.98] transition-transform shadow-lg" style={{ boxShadow: "0 4px 20px rgba(241,90,34,0.3)" }}>
              Create listing with {photos.length} photo{photos.length !== 1 ? "s" : ""} →
            </button>
          )}
        </div>
      )}

      {/* ═══════ CAMERA VIEW ═══════ */}
      {view === "camera" && (
        <div className="flex-1 flex flex-col bg-black relative">
          {shutterFlash && <div className="absolute inset-0 z-30 bg-white" style={{ animation: "flashOut 0.3s ease-out forwards" }} />}

          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#F15A22] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-3 px-8">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F15A22" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                <p className="text-white/60 text-[13px] text-center">{cameraError}</p>
                <button onClick={startCamera} className="px-4 py-2 rounded-full bg-[#F15A22] text-white text-[13px] font-medium">Retry</button>
              </div>
            )}

            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/15" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/15" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/15" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/15" />
              </div>
            )}

            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
              <button onClick={() => { stopCamera(); setView("grid"); setWtStep(1); }} className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center gap-3">
                <button onClick={switchCamera} className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" /></svg>
                </button>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
              <span className="text-white text-[12px] font-medium">{photos.length}/12</span>
            </div>
          </div>

          <div className="bg-black px-6 py-6 pb-8 flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/20">
              {photos.length > 0 ? (
                <img src={photos[photos.length - 1].src} alt="Last" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10" />
              )}
            </div>
            <button onClick={capturePhoto} disabled={!cameraReady} className={`w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-90 transition-transform ${!cameraReady ? "opacity-40" : ""}`}>
              <div className="w-[58px] h-[58px] rounded-full bg-white" />
            </button>
            <div className="w-12" />
          </div>
        </div>
      )}

      {/* ═══════ CROP VIEW ═══════ */}
      {view === "crop" && capturedImage && (
        <div className="flex-1 flex flex-col bg-[#0A0A0A]">
          <div className="flex-1 relative flex items-center justify-center px-4 py-4">
            <div
              ref={cropContainerRef}
              className="relative w-full overflow-hidden rounded-xl select-none"
              style={{ maxWidth: "380px", touchAction: "none" }}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            >
              {/* Full image always shown at natural ratio */}
              <img src={capturedImage} alt="Crop" className="w-full h-auto" draggable={false} />

              {/* Dark overlay outside crop - four rectangles */}
              {/* Top overlay */}
              <div className="absolute left-0 right-0 top-0 pointer-events-none" style={{
                height: `${cropRegion.y * 100}%`,
                background: "rgba(0,0,0,0.6)",
              }} />
              {/* Bottom overlay */}
              <div className="absolute left-0 right-0 bottom-0 pointer-events-none" style={{
                height: `${(1 - cropRegion.y - cropRegion.height) * 100}%`,
                background: "rgba(0,0,0,0.6)",
              }} />
              {/* Left overlay */}
              <div className="absolute left-0 pointer-events-none" style={{
                top: `${cropRegion.y * 100}%`,
                height: `${cropRegion.height * 100}%`,
                width: `${cropRegion.x * 100}%`,
                background: "rgba(0,0,0,0.6)",
              }} />
              {/* Right overlay */}
              <div className="absolute right-0 pointer-events-none" style={{
                top: `${cropRegion.y * 100}%`,
                height: `${cropRegion.height * 100}%`,
                width: `${(1 - cropRegion.x - cropRegion.width) * 100}%`,
                background: "rgba(0,0,0,0.6)",
              }} />

              {/* Crop area border */}
              <div className="absolute pointer-events-none" style={{
                left: `${cropRegion.x * 100}%`,
                top: `${cropRegion.y * 100}%`,
                width: `${cropRegion.width * 100}%`,
                height: `${cropRegion.height * 100}%`,
                border: "1px solid rgba(255,255,255,0.5)",
              }}>
                {/* Rule of thirds grid lines inside crop */}
                <div className="absolute top-0 bottom-0" style={{ left: "33.33%", width: "1px", background: "rgba(255,255,255,0.2)" }} />
                <div className="absolute top-0 bottom-0" style={{ left: "66.67%", width: "1px", background: "rgba(255,255,255,0.2)" }} />
                <div className="absolute left-0 right-0" style={{ top: "33.33%", height: "1px", background: "rgba(255,255,255,0.2)" }} />
                <div className="absolute left-0 right-0" style={{ top: "66.67%", height: "1px", background: "rgba(255,255,255,0.2)" }} />
              </div>

              {/* Corner handles - large touch targets (44px min) */}
              {/* Top-left */}
              <div className="absolute" style={{
                left: `calc(${cropRegion.x * 100}% - 22px)`,
                top: `calc(${cropRegion.y * 100}% - 22px)`,
                width: "44px", height: "44px", cursor: "nwse-resize",
              }}>
                <div className="absolute bottom-0 right-0" style={{
                  width: "20px", height: "20px",
                  borderLeft: "3px solid white", borderTop: "3px solid white",
                }} />
              </div>
              {/* Top-right */}
              <div className="absolute" style={{
                left: `calc(${(cropRegion.x + cropRegion.width) * 100}% - 22px)`,
                top: `calc(${cropRegion.y * 100}% - 22px)`,
                width: "44px", height: "44px", cursor: "nesw-resize",
              }}>
                <div className="absolute bottom-0 left-0" style={{
                  width: "20px", height: "20px",
                  borderRight: "3px solid white", borderTop: "3px solid white",
                }} />
              </div>
              {/* Bottom-left */}
              <div className="absolute" style={{
                left: `calc(${cropRegion.x * 100}% - 22px)`,
                top: `calc(${(cropRegion.y + cropRegion.height) * 100}% - 22px)`,
                width: "44px", height: "44px", cursor: "nesw-resize",
              }}>
                <div className="absolute top-0 right-0" style={{
                  width: "20px", height: "20px",
                  borderLeft: "3px solid white", borderBottom: "3px solid white",
                }} />
              </div>
              {/* Bottom-right */}
              <div className="absolute" style={{
                left: `calc(${(cropRegion.x + cropRegion.width) * 100}% - 22px)`,
                top: `calc(${(cropRegion.y + cropRegion.height) * 100}% - 22px)`,
                width: "44px", height: "44px", cursor: "nwse-resize",
              }}>
                <div className="absolute top-0 left-0" style={{
                  width: "20px", height: "20px",
                  borderRight: "3px solid white", borderBottom: "3px solid white",
                }} />
              </div>

              {/* Crop dimensions label */}
              {cropLabel && (
                <div className="absolute pointer-events-none" style={{
                  left: `${(cropRegion.x + cropRegion.width / 2) * 100}%`,
                  top: `${(cropRegion.y + cropRegion.height) * 100}%`,
                  transform: "translate(-50%, 8px)",
                }}>
                  <span className="px-2 py-0.5 rounded bg-black/70 text-white/70 text-[10px] font-mono whitespace-nowrap">{cropLabel}</span>
                </div>
              )}
            </div>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-center gap-3">
              {(["square", "4:3", "free"] as const).map((r) => (
                <button key={r} onClick={() => setCropRatio(r)} className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all ${cropRatio === r ? "bg-[#F15A22] text-white" : "bg-white/10 text-white/50 hover:bg-white/15"}`}>
                  {r === "square" ? "1:1" : r === "4:3" ? "4:3" : "Free"}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setView("camera"); setWtStep(2); setCapturedImage(null); }} className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-[15px] font-medium">Retake</button>
              <button onClick={handleCropApply} className="flex-1 py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium active:scale-[0.98] transition-transform">Apply →</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ENHANCE VIEW ═══════ */}
      {view === "enhance" && capturedImage && (
        <div className="flex-1 flex flex-col bg-[#0A0A0A]">
          <div className="flex-1 relative flex items-center justify-center px-4 py-4">
            <div className="relative w-full rounded-2xl overflow-hidden" style={{ maxWidth: "380px" }}>
              <img src={showBefore ? (capturedOriginal || capturedImage) : capturedImage} alt="Enhance" className="w-full h-auto" style={{ maxHeight: "400px", objectFit: "contain" }} />

              {processingAi && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-3 border-[#0047AB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/70 text-[13px] font-medium">Enhancing...</p>
                </div>
              )}

              {removingBg && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-3 border-[#F15A22] border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/70 text-[13px] font-medium">Removing background...</p>
                  <p className="text-white/40 text-[11px]">First time loads WASM model (~30s)</p>
                </div>
              )}

              {!processingAi && !removingBg && (
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium">
                    {showBefore ? "Original" : bgRemoved ? "BG Removed" : "Enhanced"}
                  </span>
                </div>
              )}

              {!processingAi && !removingBg && bgRemoved && (
                <div className="absolute bottom-3 right-3">
                  <span className="px-2.5 py-1 rounded-lg bg-[#F15A22]/80 backdrop-blur-sm text-white text-[10px] font-medium">✓ Background removed</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center justify-center">
              <button onPointerDown={() => setShowBefore(true)} onPointerUp={() => setShowBefore(false)} onPointerLeave={() => setShowBefore(false)} className="px-6 py-2.5 rounded-full bg-white/10 text-white/60 text-[13px] font-medium hover:bg-white/15 transition-all">
                Hold to see original
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-white/50 text-[13px]">AI Auto-enhance</span>
                <button onClick={() => setEnhanceOn(!enhanceOn)} className={`w-11 h-6 rounded-full transition-colors relative ${enhanceOn ? "bg-[#F15A22]" : "bg-white/20"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enhanceOn ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-white/50 text-[13px]">Remove background</span>
                <button onClick={handleRemoveBg} disabled={removingBg || bgRemoved} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${bgRemoved ? "bg-emerald-500/20 text-emerald-400" : removingBg ? "bg-white/10 text-white/30" : "bg-[#F15A22]/20 text-[#F15A22] hover:bg-[#F15A22]/30"}`}>
                  {bgRemoved ? "✓ Done" : removingBg ? "Processing..." : "Remove BG"}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setView("crop"); setWtStep(3); setBgRemoved(false); setCapturedImage(capturedOriginal); }} className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-[15px] font-medium">Re-crop</button>
              <button onClick={handleEnhanceApply} disabled={processingAi || removingBg} className="flex-1 py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium active:scale-[0.98] transition-transform disabled:opacity-40">
                Add photo →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ LISTING PANEL ═══════ */}
      {view === "listing" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl border border-[#E8E5DE] bg-white overflow-hidden shadow-sm">
            {/* Photos strip */}
            <div className="flex gap-1 p-2 overflow-x-auto scrollbar-hide">
              {photos.map((p, i) => (
                <div key={p.id} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-[#E8E5DE]">
                  <img src={p.src} alt={`${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <div className="px-4 pb-4 space-y-4">
              {/* AI-generated fields */}
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] mb-1 block">Title</label>
                <input defaultValue="Gibson Les Paul Standard '59 Reissue" className="w-full px-3 py-2.5 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[15px] text-[#1A1A1A] focus:border-[#0047AB]/40 focus:outline-none" />
                <p className="text-[10px] text-[#0047AB] mt-1">✨ AI-generated from photos</p>
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] mb-1 block">Description</label>
                <textarea defaultValue={"Gibson Les Paul Standard '59 Reissue in excellent condition. Cherry sunburst finish with flame maple top. PAF-style humbuckers, ABR-1 bridge. Includes original hardshell case."} rows={4} className="w-full px-3 py-2.5 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[14px] text-[#1A1A1A] focus:border-[#0047AB]/40 focus:outline-none resize-none leading-relaxed" />
                <p className="text-[10px] text-[#0047AB] mt-1">✨ AI-generated — edit as needed</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] mb-1 block">Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]">$</span>
                    <input defaultValue="1,450" className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[15px] text-[#1A1A1A] font-semibold focus:border-[#0047AB]/40 focus:outline-none" />
                  </div>
                  <p className="text-[10px] text-[#0047AB] mt-1">Based on 12 comps · median $1,450</p>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] mb-1 block">Condition</label>
                  <select defaultValue="like_new" className="w-full px-3 py-2.5 rounded-xl bg-[#F8F7F4] border border-[#E8E5DE] text-[15px] text-[#1A1A1A] focus:border-[#0047AB]/40 focus:outline-none appearance-none">
                    <option value="new">New</option>
                    <option value="like_new">Like New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] mb-1 block">Marketplace</label>
                <div className="flex gap-2">
                  {["eBay", "Reverb", "Etsy"].map((mp) => (
                    <button key={mp} className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${mp === "eBay" ? "bg-[#F15A22] text-white" : "bg-[#F0EDE6] text-[#6B6B6B] border border-[#E8E5DE] hover:border-[#0047AB]/30"}`}>
                      {mp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => setView("grid")} className="flex-1 py-3 rounded-2xl bg-[#F0EDE6] text-[#6B6B6B] text-[15px] font-medium border border-[#E8E5DE]">
              ← Photos
            </button>
            <button className="flex-1 py-3 rounded-2xl bg-[#F15A22] text-white text-[15px] font-medium active:scale-[0.98] transition-transform shadow-lg" style={{ boxShadow: "0 4px 20px rgba(241,90,34,0.3)" }}>
              Publish →
            </button>
          </div>
        </div>
      )}

      {/* ═══════ WALKTHROUGH ═══════ */}
      {currentWt && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {(wtStep === 0 || isLastWt) && (
            <div className="pointer-events-auto" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: "430px", height: "100%" }}>
              <div className="absolute inset-0 bg-black/60" onClick={wtStep === 0 ? advanceWt : handleRestart} />
            </div>
          )}
          <div className="pointer-events-auto" style={{
            position: "fixed", left: "calc(50% + 235px)", width: "320px",
            ...(currentWt.position === "top" ? { top: "100px" } : currentWt.position === "bottom" ? { bottom: "100px" } : { top: "50%", transform: "translateY(-50%)" }),
            animation: "fadeSlideIn 0.3s ease-out",
          }}>
            <div style={{ position: "absolute", left: "-20px", top: "50%", width: "20px", height: "2px", background: "rgba(245,158,11,0.4)", transform: "translateY(-50%)" }} />
            <div style={{ position: "absolute", left: "-24px", top: "50%", width: "8px", height: "8px", borderRadius: "50%", background: "rgba(245,158,11,0.5)", transform: "translate(-50%, -50%)" }} />
            <div className="rounded-2xl border border-amber-400/40 bg-[#1C1508] p-5 shadow-2xl" style={{ boxShadow: "0 0 40px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.4)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1">
                  {WALKTHROUGH.map((_, i) => (<div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === wtStep ? "bg-amber-400" : i < wtStep ? "bg-amber-400/40" : "bg-white/10"}`} />))}
                </div>
                <span className="text-amber-400/60 text-xs font-mono ml-1">{wtStep + 1}/{WALKTHROUGH.length}</span>
              </div>
              <h3 className="text-amber-200 text-base font-semibold mb-2">{currentWt.title}</h3>
              <p className="text-amber-100/60 text-sm leading-relaxed mb-4">{currentWt.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-amber-400 text-sm font-medium">→ {currentWt.action}</p>
                {wtStep === 0 && <button onClick={advanceWt} className="px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors">Start →</button>}
                {isLastWt && (
                  <div className="flex gap-2">
                    <button onClick={handleRestart} className="px-4 py-2 rounded-full bg-white/10 text-white/60 text-sm font-medium hover:bg-white/15 transition-colors">Replay</button>
                    <Link href="/mockups" className="px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors">Back</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DevSteps direction="Camera" steps={WALKTHROUGH} currentStep={wtStep} />
      <ReviewComments direction="camera" currentStep={wtStep} />

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes flashOut { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </div>
  );
}
