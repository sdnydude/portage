import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { UsePhotoEditReturn } from "@/hooks/use-photo-edit";

vi.mock("../listing-flow/crop-tool", () => ({
  CropTool: () => <div data-testid="crop-tool" />,
}));
vi.mock("./photo-edit-panel", () => ({
  PhotoEditPanel: (props: { error?: string | null; onClose: () => void }) => (
    <div data-testid="edit-panel" data-error={props.error ?? ""}>
      <button onClick={props.onClose}>mock-close</button>
    </div>
  ),
}));

import { PhotoEditOverlay } from "./photo-edit-overlay";

function fakePhotoEdit(overrides: Partial<UsePhotoEditReturn> = {}): UsePhotoEditReturn {
  return {
    editingIndex: 0,
    editingPhoto: { url: "https://example.com/1.jpg", key: "k1" },
    showCrop: false,
    pendingPreview: null,
    isProcessing: false,
    processingLabel: null,
    error: null,
    openEditor: vi.fn(),
    closeEditor: vi.fn(),
    openCrop: vi.fn(),
    cancelCrop: vi.fn(),
    enhanceCurrent: vi.fn(),
    bgRemoveCurrent: vi.fn(),
    applyCrop: vi.fn(),
    rotate: vi.fn(),
    ...overrides,
  } as UsePhotoEditReturn;
}

describe("PhotoEditOverlay", () => {
  it("renders nothing when closed, the panel (with the hook's error) when open, and CropTool while cropping", () => {
    const { rerender } = render(
      <PhotoEditOverlay photoEdit={fakePhotoEdit({ editingIndex: null, editingPhoto: undefined })} photoCount={2} alt="Item" />,
    );
    expect(screen.queryByTestId("edit-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("crop-tool")).not.toBeInTheDocument();

    rerender(<PhotoEditOverlay photoEdit={fakePhotoEdit({ error: "boom" })} photoCount={2} alt="Item" />);
    expect(screen.getByTestId("edit-panel")).toHaveAttribute("data-error", "boom");

    rerender(<PhotoEditOverlay photoEdit={fakePhotoEdit({ showCrop: true })} photoCount={2} alt="Item" />);
    expect(screen.getByTestId("crop-tool")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-panel")).not.toBeInTheDocument();
  });

  it("close runs the hook teardown then the host's onClosed extra", () => {
    const photoEdit = fakePhotoEdit();
    const onClosed = vi.fn();
    render(<PhotoEditOverlay photoEdit={photoEdit} photoCount={2} alt="Item" onClosed={onClosed} />);

    fireEvent.click(screen.getByText("mock-close"));
    expect(photoEdit.closeEditor).toHaveBeenCalled();
    expect(onClosed).toHaveBeenCalled();
  });
});
