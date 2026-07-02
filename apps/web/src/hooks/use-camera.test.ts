import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCamera } from "./use-camera";

afterEach(() => vi.unstubAllGlobals());

describe("useCamera.capture — square discipline", () => {
  it("draws the centered 1:1 crop of the frame onto a square canvas (eBay 2000px cap)", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    });

    const drawImage = vi.fn();
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["jpg"])),
    } as unknown as HTMLCanvasElement;
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    result.current.canvasRef.current = fakeCanvas;
    await act(async () => {
      await result.current.start();
    });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.capture();
    });

    expect(blob).not.toBeNull();
    // 640×480 frame → centered 480×480 source crop → 480×480 output canvas.
    expect(fakeCanvas.width).toBe(480);
    expect(fakeCanvas.height).toBe(480);
    expect(drawImage).toHaveBeenCalledWith(fakeVideo, 80, 0, 480, 480, 0, 0, 480, 480);
  });

  it("capture(container) crops what the on-screen guide square frames (object-cover mapping)", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    });

    const drawImage = vi.fn();
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["jpg"])),
    } as unknown as HTMLCanvasElement;
    const fakeVideo = {
      videoWidth: 2000,
      videoHeight: 1000,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    result.current.canvasRef.current = fakeCanvas;
    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.capture({ width: 500, height: 1000 });
    });

    // guideCaptureRect(2000,1000,500,1000) → (750, 250, 500) out 500.
    expect(fakeCanvas.width).toBe(500);
    expect(drawImage).toHaveBeenCalledWith(fakeVideo, 750, 250, 500, 500, 0, 0, 500, 500);
  });
});
