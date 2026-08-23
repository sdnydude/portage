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

describe("ViewControls — category chips (Housekeeping-1 [9])", () => {
  it("renders the chips from the inventory's own categories (with counts) — no static bucket list", () => {
    const props = {
      ...baseProps(),
      categories: [
        { value: "solid state drives", label: "Solid State Drives", count: 28 },
        { value: "guitar amplifiers", label: "Guitar Amplifiers", count: 3 },
      ],
    };
    render(<ViewControls {...props} />);
    const row = screen.getByRole("group", { name: "Filter by category" });
    fireEvent.click(within(row).getByRole("button", { name: /Solid State Drives\s*28/ }));
    expect(props.onCategoryChange).toHaveBeenCalledWith("solid state drives");
    expect(within(row).getByRole("button", { name: /Guitar Amplifiers\s*3/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Electronics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Automotive" })).not.toBeInTheDocument();
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
