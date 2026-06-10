import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));

// jsdom lacks ResizeObserver; CropTool observes its stage element.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { ReviewPhase } from "./swipe-flow";

const state = {
  photos: [{ url: "https://example.com/1.jpg", key: "k1" }],
  primaryPhotoIndex: 0,
  title: "Canon AE-1",
  condition: "good",
  category: "electronics",
  packageSize: "medium",
  weight: null,
  price: 100,
  marketplace: "ebay",
} as never;

describe("SwipeFlow ReviewPhase — photo gallery strip + editor overlay (S2.5-9)", () => {
  it("replaces the dumb photo strip with the gallery strip; tapping a thumb opens the editor", () => {
    render(
      <ReviewPhase
        state={state}
        setField={vi.fn()}
        onPublish={vi.fn()}
        updatePhoto={vi.fn()}
      />,
    );

    expect(screen.getByText(/tap to edit/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
  });

  it("tapping Crop in the editor opens the crop overlay", () => {
    render(
      <ReviewPhase
        state={state}
        setField={vi.fn()}
        onPublish={vi.fn()}
        updatePhoto={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /^crop$/i }));
    // CropTool overlay replaces the editor: aspect-ratio presets are its signature controls.
    expect(screen.getByText("1:1")).toBeInTheDocument();
  });
});
