import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ViewControls } from "./view-controls";

function baseProps() {
  return {
    view: "grid" as const,
    onViewChange: vi.fn(),
    total: 3,
    category: "",
    onCategoryChange: vi.fn(),
  };
}

describe("ViewControls — category chips (Housekeeping-1 T8)", () => {
  it("offers an Automotive category (the AI prompt can emit it, so the filter must too)", () => {
    render(<ViewControls {...baseProps()} />);
    expect(screen.getByRole("option", { name: "Automotive" })).toHaveValue("automotive");
  });

  it("renders status chips (All / Active / Draft / Unlisted / Asset / Sold / Archived) and reports a selection (Housekeeping-1 T6)", () => {
    const props = { ...baseProps(), status: "", onStatusChange: vi.fn() };
    render(<ViewControls {...props} />);
    const group = screen.getByRole("group", { name: "Filter by status" });
    fireEvent.click(within(group).getByRole("button", { name: "Asset" }));
    expect(props.onStatusChange).toHaveBeenCalledWith("asset");
    for (const label of ["Active", "Draft", "Unlisted", "Sold", "Archived"]) {
      expect(within(group).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
