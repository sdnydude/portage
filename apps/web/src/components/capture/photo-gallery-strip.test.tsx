import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PhotoGalleryStrip } from "./photo-gallery-strip";

const PHOTOS = [
  { key: "p1", url: "https://example.com/1.jpg" },
  { key: "p2", url: "https://example.com/2.jpg" },
  { key: "p3", url: "https://example.com/3.jpg" },
];

describe("PhotoGalleryStrip", () => {
  it("renders the photo count label, COVER tag on photo 0 only, and edit callback with the tapped index", () => {
    const onEditPhoto = vi.fn();
    render(
      <PhotoGalleryStrip
        photos={PHOTOS}
        onEditPhoto={onEditPhoto}
        onAddPhotos={vi.fn()}
        maxPhotos={12}
      />,
    );

    expect(screen.getByText(/photos · 3/i)).toBeInTheDocument();
    expect(screen.getAllByText(/cover/i)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /edit photo 2/i }));
    expect(onEditPhoto).toHaveBeenCalledWith(1);
  });

  it("shows the add tile and 'Tap to edit' hint below max, hides the tile at max", () => {
    const { rerender } = render(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} onAddPhotos={vi.fn()} maxPhotos={12} />,
    );
    expect(screen.getByLabelText(/add photos/i)).toBeInTheDocument();
    expect(screen.getByText(/tap to edit/i)).toBeInTheDocument();

    rerender(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} onAddPhotos={vi.fn()} maxPhotos={3} />,
    );
    expect(screen.queryByLabelText(/add photos/i)).not.toBeInTheDocument();
  });

  it("add tile opens the capture sheet (camera + gallery), not a bare file picker", () => {
    render(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} onAddPhotos={vi.fn()} maxPhotos={12} />,
    );
    fireEvent.click(screen.getByLabelText(/add photos/i));
    expect(screen.getByText("Add Photos")).toBeInTheDocument();
    expect(screen.getByText(/take photo/i)).toBeInTheDocument();
  });

  it("hides the add tile when no onAddPhotos handler is provided (hosts without an upload path)", () => {
    render(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} maxPhotos={12} />,
    );
    expect(screen.queryByLabelText(/add photos/i)).not.toBeInTheDocument();
  });

  it("non-editable photos (e.g. still-uploading blobs) render without the edit affordance", () => {
    const onEditPhoto = vi.fn();
    render(
      <PhotoGalleryStrip
        photos={[
          { key: "k1", url: "blob:local-1", editable: false },
          { key: "k2", url: "https://example.com/2.jpg" },
        ]}
        onEditPhoto={onEditPhoto}
        maxPhotos={12}
      />,
    );

    expect(screen.queryByRole("button", { name: /edit photo 1/i })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("edit-dot")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /edit photo 2/i }));
    expect(onEditPhoto).toHaveBeenCalledWith(1);
  });

  it("shows an edit-dot affordance on every thumb (comp: per-thumb pencil dot)", () => {
    render(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} onAddPhotos={vi.fn()} maxPhotos={12} />,
    );
    expect(screen.getAllByTestId("edit-dot")).toHaveLength(3);
  });

  it("long-press drag over another thumb fires onReorder live and commit on release", () => {
    vi.useFakeTimers();
    try {
      const onReorder = vi.fn();
      const onReorderEnd = vi.fn();
      render(
        <PhotoGalleryStrip
          photos={PHOTOS}
          onEditPhoto={vi.fn()}
          maxPhotos={12}
          onReorder={onReorder}
          onReorderEnd={onReorderEnd}
        />,
      );
      const thumb1 = screen.getByRole("button", { name: /edit photo 1/i });
      fireEvent.pointerDown(thumb1, { clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));
      document.elementFromPoint = vi
        .fn()
        .mockReturnValue(screen.getByRole("button", { name: /edit photo 3/i }));
      fireEvent.pointerMove(thumb1, { clientX: 200, clientY: 10 });
      expect(onReorder).toHaveBeenCalledWith(0, 2);
      expect(onReorderEnd).not.toHaveBeenCalled();
      fireEvent.pointerUp(thumb1);
      expect(onReorderEnd).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("header opens the manage sheet when reorder is enabled, and stays inert without it", () => {
    const { rerender } = render(
      <PhotoGalleryStrip
        photos={PHOTOS}
        onEditPhoto={vi.fn()}
        maxPhotos={12}
        onReorder={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /manage photos/i }));
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.queryByRole("button", { name: /done/i })).not.toBeInTheDocument();

    rerender(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} maxPhotos={12} />,
    );
    expect(screen.queryByRole("button", { name: /manage photos/i })).not.toBeInTheDocument();
  });

  it("the trailing click after a completed drag does NOT open the editor; the next real tap does", () => {
    vi.useFakeTimers();
    try {
      const onEditPhoto = vi.fn();
      render(
        <PhotoGalleryStrip
          photos={PHOTOS}
          onEditPhoto={onEditPhoto}
          maxPhotos={12}
          onReorder={vi.fn()}
        />,
      );
      const thumb1 = screen.getByRole("button", { name: /edit photo 1/i });
      fireEvent.pointerDown(thumb1, { clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));
      document.elementFromPoint = vi
        .fn()
        .mockReturnValue(screen.getByRole("button", { name: /edit photo 3/i }));
      fireEvent.pointerMove(thumb1, { clientX: 200, clientY: 10 });
      fireEvent.pointerUp(thumb1);
      // Browsers fire a click on the origin element after pointerup.
      fireEvent.click(thumb1);
      expect(onEditPhoto).not.toHaveBeenCalled();
      // A fresh, ordinary tap still edits.
      fireEvent.click(thumb1);
      expect(onEditPhoto).toHaveBeenCalledWith(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
