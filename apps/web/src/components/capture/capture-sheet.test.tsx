import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaptureSheet } from "./capture-sheet";

describe("CaptureSheet", () => {
  it("constrains sheet height and allows vertical scrolling on short viewports", () => {
    render(<CaptureSheet onFiles={vi.fn()} onClose={vi.fn()} />);

    const sheet = screen.getByText("Add Photos").closest("div.relative");
    expect(sheet).not.toBeNull();
    expect(sheet!.className).toContain("max-h-[85dvh]");
    expect(sheet!.className).toContain("overflow-y-auto");
  });
});
