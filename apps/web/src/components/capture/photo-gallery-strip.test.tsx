import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("hides the add tile when no onAddPhotos handler is provided (hosts without an upload path)", () => {
    render(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} maxPhotos={12} />,
    );
    expect(screen.queryByLabelText(/add photos/i)).not.toBeInTheDocument();
  });

  it("shows an edit-dot affordance on every thumb (comp: per-thumb pencil dot)", () => {
    render(
      <PhotoGalleryStrip photos={PHOTOS} onEditPhoto={vi.fn()} onAddPhotos={vi.fn()} maxPhotos={12} />,
    );
    expect(screen.getAllByTestId("edit-dot")).toHaveLength(3);
  });
});
