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

  it("long-press then dragging over another tile reorders live", () => {
    const p = renderGrid();
    const tile1 = screen.getByAltText("Photo 1").parentElement!;
    fireEvent.pointerDown(tile1, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByAltText("Photo 3").parentElement!);
    fireEvent.pointerMove(tile1, { clientX: 200, clientY: 10 });
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
  it("tapping delete does NOT also fire onEdit", () => {
    const p = renderGrid();
    const deleteButtons = screen.getAllByRole("button").filter((b) => b.textContent === "✕");
    fireEvent.pointerDown(deleteButtons[1]);
    fireEvent.pointerUp(deleteButtons[1]);
    fireEvent.click(deleteButtons[1]);
    expect(p.onDelete).toHaveBeenCalledWith(1);
    expect(p.onEdit).not.toHaveBeenCalled();
  });

  // Fixed by A4: pointercancel aborts cleanly — no phantom reorder after a
  // native-scroll take-over.
  it("pointercancel aborts the drag — no reorder on later moves", () => {
    const p = renderGrid();
    const tile1 = screen.getByAltText("Photo 1").parentElement!;
    fireEvent.pointerDown(tile1, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerCancel(tile1);
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByAltText("Photo 3").parentElement!);
    fireEvent.pointerMove(tile1, { clientX: 200, clientY: 10 });
    expect(p.onReorder).not.toHaveBeenCalled();
  });

  // Fixed by A4: releasing a completed drag commits silently — no editor pop.
  it("releasing after a completed drag does NOT open the editor", () => {
    const p = renderGrid();
    const tile1 = screen.getByAltText("Photo 1").parentElement!;
    fireEvent.pointerDown(tile1, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByAltText("Photo 3").parentElement!);
    fireEvent.pointerMove(tile1, { clientX: 200, clientY: 10 });
    expect(p.onReorder).toHaveBeenCalledWith(0, 2);
    fireEvent.pointerUp(tile1);
    expect(p.onEdit).not.toHaveBeenCalled();
  });
});
