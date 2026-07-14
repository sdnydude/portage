import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PhotoGrid } from "./photo-grid";

const photos = [
  { url: "https://example.com/1.jpg", key: "k1" },
  { url: "https://example.com/2.jpg", key: "k2" },
  { url: "https://example.com/3.jpg", key: "k3" },
];

function renderGrid(overrides: Partial<React.ComponentProps<typeof PhotoGrid>> = {}) {
  const props = {
    photos,
    minPhotos: 1,
    maxPhotos: 12,
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    ...overrides,
  };
  render(<PhotoGrid {...props} />);
  return props;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * Baseline pin of PhotoGrid's interaction contract before the drag mechanics
 * are extracted into use-photo-drag (ship F1+F2 task A4).
 */
describe("PhotoGrid baseline — current behavior", () => {
  it("renders photos with HERO badge on index 0 only", () => {
    renderGrid();
    expect(screen.getAllByText("HERO")).toHaveLength(1);
    const tile1 = screen.getByAltText("Photo 1").parentElement!;
    expect(tile1).toContainElement(screen.getByText("HERO"));
  });

  it("short tap on a tile opens the editor for that index", () => {
    const p = renderGrid();
    const tile2 = screen.getByAltText("Photo 2").parentElement!;
    fireEvent.pointerDown(tile2);
    fireEvent.pointerUp(tile2);
    expect(p.onEdit).toHaveBeenCalledWith(1);
    expect(p.onReorder).not.toHaveBeenCalled();
  });

  it("long-press then entering another tile reorders", () => {
    const p = renderGrid();
    fireEvent.pointerDown(screen.getByAltText("Photo 1").parentElement!);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerEnter(screen.getByAltText("Photo 3").parentElement!);
    expect(p.onReorder).toHaveBeenCalledWith(0, 2);
  });

  it("delete button fires onDelete for its tile", () => {
    const p = renderGrid();
    const deleteButtons = screen.getAllByRole("button").filter((b) => b.textContent === "✕");
    fireEvent.click(deleteButtons[1]);
    expect(p.onDelete).toHaveBeenCalledWith(1);
  });
});

/**
 * Known bugs confirmed by adversarial review — pinned with `it.fails` so the
 * suite stays green while documenting today's broken behavior. Task A4 (hook
 * refactor) fixes each and flips `it.fails` → `it`.
 */
describe("PhotoGrid known bugs (expected-fail until A4)", () => {
  // BUG: ✕ stops click propagation but not the bubbling pointerup — tapping
  // delete also opens the editor.
  it.fails("tapping delete does NOT also fire onEdit", () => {
    const p = renderGrid();
    const deleteButtons = screen.getAllByRole("button").filter((b) => b.textContent === "✕");
    fireEvent.pointerDown(deleteButtons[1]);
    fireEvent.pointerUp(deleteButtons[1]);
    fireEvent.click(deleteButtons[1]);
    expect(p.onDelete).toHaveBeenCalledWith(1);
    expect(p.onEdit).not.toHaveBeenCalled();
  });

  // BUG: pointercancel is unhandled — a canceled gesture (native scroll
  // take-over) leaves the grid in dragging state; the next pointerenter
  // fires a phantom reorder.
  it.fails("pointercancel aborts the drag — no reorder on later pointerenter", () => {
    const p = renderGrid();
    fireEvent.pointerDown(screen.getByAltText("Photo 1").parentElement!);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerCancel(screen.getByAltText("Photo 1").parentElement!);
    fireEvent.pointerEnter(screen.getByAltText("Photo 3").parentElement!);
    expect(p.onReorder).not.toHaveBeenCalled();
  });

  // BUG: handleDrop commits + clears drag state on pointerenter; the release
  // that follows sees !isDragging and fires onEdit — editor pops open after
  // every completed drag.
  it.fails("releasing after a completed drop does NOT open the editor", () => {
    const p = renderGrid();
    fireEvent.pointerDown(screen.getByAltText("Photo 1").parentElement!);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerEnter(screen.getByAltText("Photo 3").parentElement!);
    expect(p.onReorder).toHaveBeenCalledWith(0, 2);
    fireEvent.pointerUp(screen.getByAltText("Photo 3").parentElement!);
    expect(p.onEdit).not.toHaveBeenCalled();
  });
});
