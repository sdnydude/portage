import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DisclaimerSheet } from "./disclaimer-sheet";

describe("DisclaimerSheet — F3b suppress checkbox", () => {
  it("passes suppress7d=true to onAccept when 'don't show for 7 days' is checked", () => {
    const onAccept = vi.fn();
    render(<DisclaimerSheet itemId="i1" isFirstTime={true} onAccept={onAccept} onCancel={() => {}} />);

    // The agree checkbox (first) gates the Accept button.
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    // Opt in to 7-day suppression.
    fireEvent.click(screen.getByLabelText("Don't show again for 7 days"));
    fireEvent.click(screen.getByRole("button", { name: "Accept & Publish" }));

    expect(onAccept).toHaveBeenCalledWith(true);
  });

  it("passes suppress7d=false when the suppression box is left unchecked", () => {
    const onAccept = vi.fn();
    render(<DisclaimerSheet itemId="i1" isFirstTime={true} onAccept={onAccept} onCancel={() => {}} />);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Accept & Publish" }));

    expect(onAccept).toHaveBeenCalledWith(false);
  });
});
