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
});
