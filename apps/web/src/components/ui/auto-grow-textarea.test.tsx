import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutoGrowTextarea } from "./auto-grow-textarea";

describe("AutoGrowTextarea", () => {
  it("sets its height from scrollHeight on mount and after the value changes, capped at maxHeight", () => {
    // jsdom has no layout: scrollHeight is whatever we say it is.
    let scrollHeight = 120;
    const spy = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(() => scrollHeight);

    const { rerender } = render(<AutoGrowTextarea aria-label="Notes" value="one line" onChange={() => {}} maxHeight={300} />);
    const el = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(el.style.height).toBe("120px");
    expect(el.style.overflowY).toBe("hidden");

    scrollHeight = 900;
    rerender(<AutoGrowTextarea aria-label="Notes" value={"many\nlines\nof\nnotes"} onChange={() => {}} maxHeight={300} />);
    expect(el.style.height).toBe("300px");
    expect(el.style.overflowY).toBe("auto");

    spy.mockRestore();
  });

  it("does not rewrite the height while focused when the content still fits (iOS caret desync, 2026-09-06)", () => {
    const scrollHeight = 120;
    const spy = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(() => scrollHeight);
    const { rerender } = render(<AutoGrowTextarea aria-label="Notes" value="one" onChange={() => {}} />);
    const el = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    el.focus();
    const heightAfterMount = el.style.height;
    const writes: string[] = [];
    const orig = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "height");
    Object.defineProperty(el.style, "height", { set(v) { writes.push(String(v)); }, get() { return heightAfterMount; }, configurable: true });
    rerender(<AutoGrowTextarea aria-label="Notes" value="one two" onChange={() => {}} />);
    expect(writes).toEqual([]);           // same scrollHeight → no style write
    if (orig) Object.defineProperty(el.style, "height", orig);
    spy.mockRestore();
  });

  it("keeps its fitted px height when unfocused and a new value has the same scrollHeight (stale-current regression, 2026-09-08)", () => {
    const scrollHeight = 120;
    const spy = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(() => scrollHeight);
    const { rerender } = render(<AutoGrowTextarea aria-label="Notes" value="one" onChange={() => {}} />);
    const el = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(el.style.height).toBe("120px");
    rerender(<AutoGrowTextarea aria-label="Notes" value="two" onChange={() => {}} />);
    expect(el.style.height).toBe("120px");
    spy.mockRestore();
  });
});
