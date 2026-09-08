import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pager } from "./pager";

describe("Pager", () => {
  it("shows the range, moves pages, and changes the page size through a 25/50/100 select", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(<Pager page={2} pageSize={50} total={201} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />);

    expect(screen.getByText("51–100 of 201")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.change(screen.getByLabelText("Items per page"), { target: { value: "100" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });
});
