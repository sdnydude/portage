import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExposureTool } from "./exposure-tool";

describe("ExposureTool", () => {
  it("live-previews the EV via a CSS brightness filter and applies the chosen value", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <ExposureTool imageUrl="https://example.com/1.jpg" onApply={onApply} onCancel={onCancel} />,
    );

    const img = screen.getByAltText("Exposure preview") as HTMLImageElement;
    // Default EV 0 → brightness(1)
    expect(img.style.filter).toBe("brightness(1)");

    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "1" } });
    // +1 EV → brightness(2) — one photographic stop
    expect(img.style.filter).toBe("brightness(2)");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancel dismisses without applying", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <ExposureTool imageUrl="https://example.com/1.jpg" onApply={onApply} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
