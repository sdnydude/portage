import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScanReviewActions } from "./scan-review-actions";

const baseProps = {
  price: 50 as number | null,
  onPriceChange: vi.fn(),
  onRescan: vi.fn(),
  onSave: vi.fn(),
  onSaveAndList: vi.fn(),
  isSaving: false,
  isListing: false,
  canSave: true,
};

describe("ScanReviewActions", () => {
  it("shows the editable price and routes Save & List", () => {
    const onPriceChange = vi.fn();
    const onSaveAndList = vi.fn();
    render(<ScanReviewActions {...baseProps} price={50} onPriceChange={onPriceChange} onSaveAndList={onSaveAndList} />);

    const input = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    expect(input.value).toBe("50");
    fireEvent.change(input, { target: { value: "120" } });
    expect(onPriceChange).toHaveBeenCalledWith(120);

    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));
    expect(onSaveAndList).toHaveBeenCalled();
  });

  it("disables only Save & List with an accessible reason when canList is false", () => {
    render(
      <ScanReviewActions
        {...baseProps}
        canList={false}
        listDisabledReason="Complete 2 required eBay details first"
      />,
    );

    const listButton = screen.getByRole("button", { name: "Save & List" });
    expect(listButton).toBeDisabled();
    expect(listButton).toHaveAttribute("aria-describedby");
    expect(screen.getByText("Complete 2 required eBay details first")).toBeInTheDocument();
    // Save stays enabled — inventory save is never gated by eBay aspects.
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
