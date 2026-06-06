import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AspectFillSheet } from "./aspect-fill-sheet";

describe("AspectFillSheet", () => {
  it("disables Save until every required specific has a value, then emits eBay-shaped aspects", () => {
    const onSave = vi.fn();
    render(
      <AspectFillSheet
        missing={[{ name: "Preamp Type", values: ["Tube", "Solid State"] }]}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const save = screen.getByRole("button", { name: /save & publish/i });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Tube" }));
    expect(save).toBeEnabled();

    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({ "Preamp Type": ["Tube"] });
  });

  it("renders a free-text input when eBay supplies no allowed values", () => {
    const onSave = vi.fn();
    render(
      <AspectFillSheet
        missing={[{ name: "Custom Spec", values: null }]}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter Custom Spec"), { target: { value: "  Vintage  " } });
    fireEvent.click(screen.getByRole("button", { name: /save & publish/i }));
    expect(onSave).toHaveBeenCalledWith({ "Custom Spec": ["Vintage"] });
  });

  it("prefills a known value (e.g. Brand) so it counts as filled", () => {
    render(
      <AspectFillSheet
        missing={[{ name: "Brand", values: null }]}
        initial={{ Brand: ["Cloud Microphones"] }}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /save & publish/i })).toBeEnabled();
    expect(screen.getByDisplayValue("Cloud Microphones")).toBeInTheDocument();
  });
});
