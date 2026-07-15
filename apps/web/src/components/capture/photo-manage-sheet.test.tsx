import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PhotoManageSheet } from "./photo-manage-sheet";

const PHOTOS = [
  { key: "p1", url: "https://example.com/1.jpg" },
  { key: "p2", url: "https://example.com/2.jpg" },
  { key: "p3", url: "https://example.com/3.jpg" },
];

describe("PhotoManageSheet", () => {
  it("renders a full-screen grid of all photos with COVER on index 0 and a close button", () => {
    render(
      <PhotoManageSheet
        photos={PHOTOS}
        onClose={vi.fn()}
        onReorder={vi.fn()}
        onReorderEnd={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getAllByAltText(/photo \d/i)).toHaveLength(3);
    expect(screen.getAllByText("COVER")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("delete ✕ fires onDelete without arming a drag", () => {
    vi.useFakeTimers();
    try {
      const onDelete = vi.fn();
      const onReorder = vi.fn();
      render(
        <PhotoManageSheet
          photos={PHOTOS}
          onClose={vi.fn()}
          onReorder={onReorder}
          onDelete={onDelete}
        />,
      );
      const x = screen.getByRole("button", { name: /delete photo 2/i });
      fireEvent.pointerDown(x, { clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(x);
      fireEvent.click(x);
      expect(onDelete).toHaveBeenCalledWith(1);
      expect(onReorder).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
