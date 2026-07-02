import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  capture: vi.fn(),
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
  }),
}));

import { CameraCapture } from "./camera-capture";

beforeEach(() => {
  h.capture.mockReset();
  h.capture.mockResolvedValue(new Blob(["jpg"], { type: "image/jpeg" }));
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
