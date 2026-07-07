import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoEditPanel } from "./photo-edit-panel";

const BASE = {
  photo: { url: "https://example.com/1.jpg" },
  photoIndex: 0,
  photoCount: 4,
  onClose: vi.fn(),
  onRotate: vi.fn(),
  onCrop: vi.fn(),
  onEnhance: vi.fn(),
  onBgRemove: vi.fn(),
  isProcessing: false,
  processingLabel: null,
  pendingPreview: null,
};

describe("PhotoEditPanel", () => {
  it("renders all 4 tools and close; tool taps call their callbacks", () => {
    const onRotate = vi.fn();
    const onClose = vi.fn();
    render(<PhotoEditPanel {...BASE} onRotate={onRotate} onClose={onClose} />);

    expect(screen.getByRole("button", { name: /rotate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bg remove/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /rotate/i }));
    expect(onRotate).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /close editor/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows accept/discard instead of the toolbar while a preview is pending", () => {
    const onAccept = vi.fn();
    const onDiscard = vi.fn();
    render(
      <PhotoEditPanel
        {...BASE}
        pendingPreview={{
          beforeUrl: "https://example.com/1.jpg",
          afterUrl: "https://example.com/1-enhanced.jpg",
          alt: "Enhanced preview",
          onAccept,
          onDiscard,
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: /rotate/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /use this photo/i }));
    expect(onAccept).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalled();
  });

  it("close is disabled while a tool is processing (no invisible background mutations)", () => {
    render(<PhotoEditPanel {...BASE} isProcessing processingLabel="Rotating..." />);
    expect(screen.getByRole("button", { name: /close editor/i })).toBeDisabled();
  });

  it("renders the host's error inside the overlay so failures are never invisible", () => {
    render(<PhotoEditPanel {...BASE} error="Rotation failed" />);
    expect(screen.getByText("Rotation failed")).toBeInTheDocument();
  });

  it("omits Rotate/Crop when the host provides no handlers", () => {
    render(<PhotoEditPanel {...BASE} onRotate={undefined} onCrop={undefined} />);
    expect(screen.queryByRole("button", { name: /rotate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crop/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bg remove/i })).toBeInTheDocument();
  });

  it("renders an Exposure tool when the host wires onExposure, and taps call it", () => {
    const onExposure = vi.fn();
    render(<PhotoEditPanel {...BASE} onExposure={onExposure} />);
    fireEvent.click(screen.getByRole("button", { name: /exposure/i }));
    expect(onExposure).toHaveBeenCalled();
  });

  it("each tool shows its own icon, not a shared placeholder", () => {
    render(<PhotoEditPanel {...BASE} />);
    expect(screen.getByTestId("tool-icon-rotate")).toBeInTheDocument();
    expect(screen.getByTestId("tool-icon-crop")).toBeInTheDocument();
    expect(screen.getByTestId("tool-icon-enhance")).toBeInTheDocument();
    expect(screen.getByTestId("tool-icon-bg-remove")).toBeInTheDocument();
  });
});
