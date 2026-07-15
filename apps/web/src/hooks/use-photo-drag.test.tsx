import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { usePhotoDrag, type UsePhotoDragOptions } from "./use-photo-drag";

/**
 * Probe host: three tiles wired through getItemProps, hook state exposed as
 * text so tests observe activation/drag without reaching into internals.
 */
function Probe(opts: Partial<UsePhotoDragOptions>) {
  const drag = usePhotoDrag({ onMove: vi.fn(), ...opts });
  return (
    <div>
      <span data-testid="state">{drag.isDragging ? `dragging:${drag.dragIndex}` : "idle"}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} data-testid={`tile-${i}`} {...drag.getItemProps(i)}>
          tile {i}
        </div>
      ))}
    </div>
  );
}

/** Probe variant whose first tile hosts a nested interactive child. */
function ProbeWithChild({ child, ...opts }: Partial<UsePhotoDragOptions> & { child: React.ReactNode }) {
  const drag = usePhotoDrag({ onMove: vi.fn(), ...opts });
  return (
    <div>
      <span data-testid="state">{drag.isDragging ? `dragging:${drag.dragIndex}` : "idle"}</span>
      <div data-testid="tile-0" {...drag.getItemProps(0)}>
        tile 0{child}
      </div>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("usePhotoDrag", () => {
  it("stamps each item with a data-photo-drag-index for hit-testing", () => {
    render(<Probe />);
    expect(screen.getByTestId("tile-1").getAttribute("data-photo-drag-index")).toBe("1");
  });

  it("activates drag after the long-press delay", () => {
    render(<Probe />);
    fireEvent.pointerDown(screen.getByTestId("tile-1"), { clientX: 10, clientY: 10 });
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("state")).toHaveTextContent("dragging:1");
  });

  it("short press-and-release fires onTap, never a drag", () => {
    const onTap = vi.fn();
    const onMove = vi.fn();
    render(<Probe onTap={onTap} onMove={onMove} />);
    const tile = screen.getByTestId("tile-2");
    fireEvent.pointerDown(tile, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerUp(tile);
    expect(onTap).toHaveBeenCalledWith(2);
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
  });

  it("moving over another tile fires onMove and dragIndex follows the photo", () => {
    const onMove = vi.fn();
    render(<Probe onMove={onMove} />);
    const tile0 = screen.getByTestId("tile-0");
    fireEvent.pointerDown(tile0, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    // Touch keeps events on the pressed element — hit-testing goes through
    // document.elementFromPoint. jsdom doesn't implement it; stub it.
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByTestId("tile-2"));
    fireEvent.pointerMove(tile0, { clientX: 200, clientY: 10 });
    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(screen.getByTestId("state")).toHaveTextContent("dragging:2");
  });

  it("release after a move fires onDrop once, resets state, and never onTap", () => {
    const onDrop = vi.fn();
    const onTap = vi.fn();
    render(<Probe onDrop={onDrop} onTap={onTap} />);
    const tile0 = screen.getByTestId("tile-0");
    fireEvent.pointerDown(tile0, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByTestId("tile-1"));
    fireEvent.pointerMove(tile0, { clientX: 100, clientY: 10 });
    fireEvent.pointerUp(tile0);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    // A fresh pointermove after release must not move anything.
    fireEvent.pointerMove(tile0, { clientX: 150, clientY: 10 });
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("pointercancel aborts the drag without onDrop or onTap; later moves are inert", () => {
    const onMove = vi.fn();
    const onDrop = vi.fn();
    const onTap = vi.fn();
    render(<Probe onMove={onMove} onDrop={onDrop} onTap={onTap} />);
    const tile0 = screen.getByTestId("tile-0");
    fireEvent.pointerDown(tile0, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerCancel(tile0);
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByTestId("tile-2"));
    fireEvent.pointerMove(tile0, { clientX: 200, clientY: 10 });
    expect(onMove).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("presses starting on a [data-photo-drag-ignore] child never arm drag or tap", () => {
    const onTap = vi.fn();
    render(
      <ProbeWithChild
        onTap={onTap}
        child={<button data-photo-drag-ignore data-testid="delete-x">✕</button>}
      />,
    );
    const x = screen.getByTestId("delete-x");
    fireEvent.pointerDown(x, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    fireEvent.pointerUp(x);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("moving beyond the tolerance before activation cancels the pending press (scroll wins)", () => {
    const onMove = vi.fn();
    render(<Probe onMove={onMove} />);
    const tile0 = screen.getByTestId("tile-0");
    fireEvent.pointerDown(tile0, { clientX: 10, clientY: 10 });
    // Finger slides 40px before the 500ms delay elapses — native scroll.
    fireEvent.pointerMove(tile0, { clientX: 10, clientY: 50 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("disabled items neither arm a drag nor accept a drop", () => {
    const onMove = vi.fn();
    render(<Probe onMove={onMove} disabled={(i) => i === 1} />);
    // Disabled item can't start a drag.
    fireEvent.pointerDown(screen.getByTestId("tile-1"), { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    // Disabled item can't be a drop target either.
    fireEvent.pointerDown(screen.getByTestId("tile-0"), { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByTestId("tile-1"));
    fireEvent.pointerMove(screen.getByTestId("tile-0"), { clientX: 100, clientY: 10 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("mouse: press-and-drag activates immediately on movement — no long-press hold required", () => {
    const onMove = vi.fn();
    render(<Probe onMove={onMove} />);
    const tile0 = screen.getByTestId("tile-0");
    fireEvent.pointerDown(tile0, { pointerType: "mouse", buttons: 1, clientX: 10, clientY: 10 });
    document.elementFromPoint = vi.fn().mockReturnValue(screen.getByTestId("tile-2"));
    // 20px travel well before the 500ms timer — touch would cancel; mouse must drag.
    fireEvent.pointerMove(tile0, { pointerType: "mouse", buttons: 1, clientX: 30, clientY: 10 });
    fireEvent.pointerMove(tile0, { pointerType: "mouse", buttons: 1, clientX: 200, clientY: 10 });
    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(screen.getByTestId("state")).toHaveTextContent("dragging:2");
  });

  it("mouse: plain click (no meaningful movement) is still a tap", () => {
    const onTap = vi.fn();
    const onMove = vi.fn();
    render(<Probe onTap={onTap} onMove={onMove} />);
    const tile1 = screen.getByTestId("tile-1");
    fireEvent.pointerDown(tile1, { pointerType: "mouse", buttons: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(tile1, { pointerType: "mouse", buttons: 1, clientX: 12, clientY: 11 });
    fireEvent.pointerUp(tile1, { pointerType: "mouse" });
    expect(onTap).toHaveBeenCalledWith(1);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("suppresses the long-press context menu on tiles (iOS image callout steals the drag)", () => {
    render(<Probe />);
    const tile = screen.getByTestId("tile-0");
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    tile.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("suppresses native scroll while dragging via a non-passive document touchmove listener", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    render(<Probe />);
    const tile0 = screen.getByTestId("tile-0");
    fireEvent.pointerDown(tile0, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));
    expect(addSpy).toHaveBeenCalledWith("touchmove", expect.any(Function), { passive: false });
    fireEvent.pointerUp(tile0);
    expect(removeSpy).toHaveBeenCalledWith("touchmove", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
