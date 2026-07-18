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

describe("useCamera zoom", () => {
  it("digital zoom (no track zoom capability) shrinks the capture crop around center", async () => {
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

    expect(result.current.zoomMode).toBe("digital");
    await act(async () => {
      result.current.setZoom(2);
    });
    expect(result.current.zoom).toBe(2);

    await act(async () => {
      await result.current.capture();
    });

    // Base centered crop (80, 0, 480) zoomed 2x → (200, 120, 240).
    expect(fakeCanvas.width).toBe(240);
    expect(drawImage).toHaveBeenCalledWith(fakeVideo, 200, 120, 240, 240, 0, 0, 240, 240);
  });

  it("digital mode caps maxZoom at 3 and setZoom clamps into [1, maxZoom]", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.maxZoom).toBe(3);
    await act(async () => {
      result.current.setZoom(99);
    });
    expect(result.current.zoom).toBe(3);
    await act(async () => {
      result.current.setZoom(0.2);
    });
    expect(result.current.zoom).toBe(1);
  });

  it("native mode: uses hardware zoom range, applies zoom via track constraints, capture crop unchanged", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const fakeTrack = {
      stop: vi.fn(),
      getCapabilities: () => ({ zoom: { min: 1, max: 8 } }),
      applyConstraints,
    };
    const fakeStream = { getTracks: () => [fakeTrack] } as unknown as MediaStream;
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

    expect(result.current.zoomMode).toBe("native");
    expect(result.current.maxZoom).toBe(8);

    await act(async () => {
      result.current.setZoom(2);
    });
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] });

    await act(async () => {
      await result.current.capture();
    });
    // Sensor already zoomed the frames — capture keeps the full centered crop.
    expect(drawImage).toHaveBeenCalledWith(fakeVideo, 80, 0, 480, 480, 0, 0, 480, 480);
  });

  it("exposes the hardware minZoom (0.5 on ultra-wide-capable iPhones); digital floor stays 1", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const fakeTrack = {
      stop: vi.fn(),
      getCapabilities: () => ({ zoom: { min: 0.5, max: 10 } }),
      applyConstraints,
    };
    const fakeStream = { getTracks: () => [fakeTrack] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    });
    const fakeVideo = {
      videoWidth: 640, videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => { await result.current.start(); });
    expect(result.current.zoomMode).toBe("native");
    expect(result.current.minZoom).toBe(0.5);
    // setZoom below the floor clamps to it, not to 1.
    await act(async () => { result.current.setZoom(0.25); });
    expect(result.current.zoom).toBe(0.5);
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 0.5 }] });
  });

  it("switchCamera resets zoom to 1", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      result.current.setZoom(2);
    });
    expect(result.current.zoom).toBe(2);

    await act(async () => {
      await result.current.switchCamera();
    });
    expect(result.current.zoom).toBe(1);
  });
});

describe("useCamera device selection", () => {
  it("lists video input devices after the stream starts (labels need the permission grant)", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream),
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: "videoinput", deviceId: "builtin", label: "FaceTime HD Camera" },
          { kind: "videoinput", deviceId: "iphone", label: "iPhone Camera" },
          { kind: "audioinput", deviceId: "mic", label: "Built-in Mic" },
        ]),
      },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.devices).toEqual([
      { deviceId: "builtin", label: "FaceTime HD Camera" },
      { deviceId: "iphone", label: "iPhone Camera" },
    ]);
  });

  it("selectDevice restarts the stream pinned to that deviceId and resets zoom", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: "videoinput", deviceId: "builtin", label: "FaceTime HD Camera" },
          { kind: "videoinput", deviceId: "iphone", label: "iPhone Camera" },
        ]),
      },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      result.current.setZoom(2);
    });

    await act(async () => {
      await result.current.selectDevice("iphone");
    });

    expect(result.current.activeDeviceId).toBe("iphone");
    expect(result.current.zoom).toBe(1);
    const lastCall = getUserMedia.mock.calls.at(-1)![0];
    expect(lastCall.video.deviceId).toEqual({ exact: "iphone" });
    // Pinned device must not fight a facingMode preference.
    expect(lastCall.video.facingMode).toBeUndefined();
  });

  it("switchCamera unpins the selected device and returns to facingMode", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.selectDevice("iphone");
    });

    await act(async () => {
      await result.current.switchCamera();
    });

    expect(result.current.activeDeviceId).toBeNull();
    const lastCall = getUserMedia.mock.calls.at(-1)![0];
    expect(lastCall.video.deviceId).toBeUndefined();
    expect(lastCall.video.facingMode).toBe("user");
  });

  it("remembers the selected device across hook instances (localStorage)", async () => {
    localStorage.clear();
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const first = renderHook(() => useCamera());
    first.result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await first.result.current.start();
    });
    await act(async () => {
      await first.result.current.selectDevice("iphone");
    });
    first.unmount();

    // Fresh session: the camera opens straight on the remembered device.
    const second = renderHook(() => useCamera());
    second.result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await second.result.current.start();
    });
    expect(second.result.current.activeDeviceId).toBe("iphone");
    expect(getUserMedia.mock.calls.at(-1)![0].video.deviceId).toEqual({ exact: "iphone" });
    localStorage.clear();
  });

  it("falls back to facingMode when the remembered device is gone", async () => {
    localStorage.setItem("portage_camera_device", "iphone-gone");
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const overconstrained = Object.assign(new Error("device not found"), { name: "OverconstrainedError" });
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(overconstrained)
      .mockResolvedValue(fakeStream);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isReady).toBe(true);
    expect(result.current.activeDeviceId).toBeNull();
    expect(getUserMedia.mock.calls.at(-1)![0].video.facingMode).toBe("environment");
    // The stale remembered device must not be retried on every future start.
    expect(localStorage.getItem("portage_camera_device")).toBeNull();
    localStorage.clear();
  });

  it("requests the zoom capability in getUserMedia constraints (Chrome PTZ permission gate)", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });

    expect(getUserMedia.mock.calls.at(-1)![0].video.zoom).toBe(true);
  });

  it("refreshes the device list when the browser fires devicechange (Continuity Camera appearing late)", async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const listeners: Record<string, () => void> = {};
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: "videoinput", deviceId: "builtin", label: "FaceTime HD Camera" },
    ]);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream),
        enumerateDevices,
        addEventListener: vi.fn((ev: string, cb: () => void) => { listeners[ev] = cb; }),
        removeEventListener: vi.fn(),
      },
    });
    const fakeVideo = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      set srcObject(_v: unknown) {},
    } as unknown as HTMLVideoElement;

    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = fakeVideo;
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.devices).toHaveLength(1);

    // iPhone enters Continuity range after the camera opened.
    enumerateDevices.mockResolvedValue([
      { kind: "videoinput", deviceId: "builtin", label: "FaceTime HD Camera" },
      { kind: "videoinput", deviceId: "iphone", label: "iPhone Camera" },
    ]);
    await act(async () => {
      listeners["devicechange"]?.();
      await Promise.resolve();
    });

    expect(result.current.devices).toEqual([
      { deviceId: "builtin", label: "FaceTime HD Camera" },
      { deviceId: "iphone", label: "iPhone Camera" },
    ]);
  });
});
