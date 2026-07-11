import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmSheet } from "./confirm-sheet";

describe("ConfirmSheet", () => {
  it("renders title/body and wires confirm + close", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmSheet
        title="Archive Listing"
        body="This will archive your listing."
        confirmLabel="Archive"
        destructive={false}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Archive Listing")).toBeInTheDocument();
    expect(screen.getByText("This will archive your listing.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
