import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { CropTool } from "./crop-tool";

let rectSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // The stage measures 400×400 → crop window side 400.
  rectSpy = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockReturnValue({ width: 400, height: 400, top: 0, left: 0, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => rectSpy.mockRestore());

describe("CropTool — stationary 1:1 window, movable image", () => {
  it("Apply at rest emits the image's centered cover square", () => {
    const onApply = vi.fn();
    render(
      <CropTool imageUrl="https://x/p.jpg" imageWidth={2000} imageHeight={1000} onApply={onApply} onCancel={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    // cover scale 0.4; centered → x = 500; square crop = 1000.
    expect(onApply).toHaveBeenCalledWith({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it("dragging pans the image (clamped) and the emitted region follows", () => {
    const onApply = vi.fn();
    const { container } = render(
      <CropTool imageUrl="https://x/p.jpg" imageWidth={2000} imageHeight={1000} onApply={onApply} onCancel={() => {}} />,
    );
    const stage = container.querySelector('[data-testid="crop-window"]')!.parentElement!;

    // Drag 120px right: offsetX -200 → -80 → x = 80/0.4 = 200.
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 320, clientY: 200 });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({ x: 200, y: 0, width: 1000, height: 1000 });
  });

  it("wheel-zoom shrinks the crop region; zoom-out below cover-fit is clamped", () => {
    const onApply = vi.fn();
    const { container } = render(
      <CropTool imageUrl="https://x/p.jpg" imageWidth={2000} imageHeight={1000} onApply={onApply} onCancel={() => {}} />,
    );
    const stage = container.querySelector('[data-testid="crop-window"]')!.parentElement!;

    // Zoom in once (×1.1) at the window center → crop side 1000/1.1 ≈ 909.
    fireEvent.wheel(stage, { deltaY: -100, clientX: 200, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const zoomed = onApply.mock.calls[0][0];
    expect(zoomed.width).toBe(909);
    expect(zoomed.height).toBe(909);

    // Zoom out twice: clamps back at cover-fit (never below zoom 1).
    fireEvent.wheel(stage, { deltaY: 100, clientX: 200, clientY: 200 });
    fireEvent.wheel(stage, { deltaY: 100, clientX: 200, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply.mock.calls[1][0]).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });
});
