import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  capture: vi.fn(),
  setZoom: vi.fn(),
  zoom: 1,
  zoomMode: "digital" as "native" | "digital" | null,
  devices: [] as { deviceId: string; label: string }[],
  activeDeviceId: null as string | null,
  selectDevice: vi.fn(),
}));

vi.mock("@/hooks/use-camera", () => ({
  useCamera: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    isReady: true,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
    capture: h.capture,
    switchCamera: vi.fn(),
    zoom: h.zoom,
    maxZoom: 3,
    zoomMode: h.zoomMode,
    setZoom: h.setZoom,
    devices: h.devices,
    activeDeviceId: h.activeDeviceId,
    selectDevice: h.selectDevice,
  }),
}));

import { CameraCapture } from "./camera-capture";

beforeEach(() => {
  h.capture.mockReset();
  h.capture.mockResolvedValue(new Blob(["jpg"], { type: "image/jpeg" }));
  h.setZoom.mockReset();
  h.zoom = 1;
  h.zoomMode = "digital";
  h.selectDevice.mockReset();
  h.devices = [];
  h.activeDeviceId = null;
});

describe("CameraCapture — 1:1 guide discipline", () => {
  it("renders the square capture guide over the viewfinder", () => {
    render(<CameraCapture onCapture={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId("square-guide")).toBeInTheDocument();
  });

  it("multi-shot: capturing keeps the camera session alive; Done closes once", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const onCapture = vi.fn();
    const onClose = vi.fn();
    render(<CameraCapture onCapture={onCapture} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /capture photo/i }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /capture photo/i }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(2));

    // The session never closed between shots — no re-prompt on iOS/macOS.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes the measured viewfinder size to capture so the crop matches the guide", async () => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 390, height: 700, top: 0, left: 0, right: 390, bottom: 700, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    const { fireEvent, waitFor } = await import("@testing-library/react");
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /capture photo/i }));
    await waitFor(() => expect(onCapture).toHaveBeenCalled());
    expect(h.capture).toHaveBeenCalledWith({ width: 390, height: 700 });

    rectSpy.mockRestore();
  });
});

describe("CameraCapture — zoom", () => {
  it("renders zoom chips and tapping 2× sets zoom to 2", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<CameraCapture onCapture={() => {}} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /zoom 2×/i }));
    expect(h.setZoom).toHaveBeenCalledWith(2);
  });

  it("digital mode scales the viewfinder video by the zoom factor; native mode does not", () => {
    h.zoom = 2;
    h.zoomMode = "digital";
    const { container, unmount } = render(<CameraCapture onCapture={() => {}} onClose={() => {}} />);
    expect((container.querySelector("video") as HTMLVideoElement).style.transform).toBe("scale(2)");
    unmount();

    h.zoomMode = "native";
    const { container: c2 } = render(<CameraCapture onCapture={() => {}} onClose={() => {}} />);
    expect((c2.querySelector("video") as HTMLVideoElement).style.transform).toBe("");
  });

  it("device picker: hidden with one camera, lists cameras and pins the tapped one with several", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { unmount } = render(<CameraCapture onCapture={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /choose camera/i })).not.toBeInTheDocument();
    unmount();

    h.devices = [
      { deviceId: "builtin", label: "FaceTime HD Camera" },
      { deviceId: "iphone", label: "iPhone Camera" },
    ];
    render(<CameraCapture onCapture={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /choose camera/i }));
    fireEvent.click(screen.getByRole("button", { name: "iPhone Camera" }));
    expect(h.selectDevice).toHaveBeenCalledWith("iphone");
  });

  it("pinching outward on the viewfinder zooms in proportionally", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<CameraCapture onCapture={() => {}} onClose={() => {}} />);
    const viewfinder = screen.getByTestId("viewfinder");

    // Two fingers 100px apart, spreading to 200px → 2× the starting zoom (1).
    fireEvent.pointerDown(viewfinder, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewfinder, { pointerId: 2, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewfinder, { pointerId: 2, clientX: 300, clientY: 100 });

    expect(h.setZoom).toHaveBeenCalledWith(2);
  });
});
