import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RescanDiffSheet } from "./rescan-diff-sheet";
import type { RescanRow } from "@/lib/rescan-diff";

const rows: RescanRow[] = [
  { key: "title", label: "Title", current: "Canon AE-1", next: "Canon AE-1 Program", selected: false },
  { key: "aspect:Film Format", label: "Film Format", current: "", next: "35 mm", selected: true },
];

describe("RescanDiffSheet", () => {
  it("renders current vs new per row, pre-checks empty-current rows, and applies only the checked keys", () => {
    const onApply = vi.fn();
    render(<RescanDiffSheet rows={rows} onApply={onApply} onClose={vi.fn()} />);
    expect(screen.getByText("Canon AE-1")).toBeInTheDocument();
    expect(screen.getByText("Canon AE-1 Program")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Title" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Film Format" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 change" }));
    expect(onApply).toHaveBeenCalledWith(["aspect:Film Format"]);
  });

  it("with no differing rows says the scan agrees and offers only Close", () => {
    render(<RescanDiffSheet rows={[]} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("The scan agrees with your current details.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("warns that applying also updates a live listing only when the item has one", () => {
    const { rerender } = render(<RescanDiffSheet rows={rows} hasLiveListing onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Applying also updates your live listing.")).toBeInTheDocument();
    rerender(<RescanDiffSheet rows={rows} hasLiveListing={false} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText("Applying also updates your live listing.")).not.toBeInTheDocument();
  });

  it("Select all checks every row, and unchecks every row when tapped again", () => {
    render(<RescanDiffSheet rows={rows} onApply={vi.fn()} onClose={vi.fn()} />);
    const all = screen.getByRole("checkbox", { name: "Select all" });
    fireEvent.click(all);
    expect(screen.getByRole("checkbox", { name: "Title" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Apply 2 changes" })).toBeInTheDocument();
    fireEvent.click(all);
    expect(screen.getByRole("checkbox", { name: "Film Format" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Apply 0 changes" })).toBeDisabled();
  });

  // Reviewer 2026-09-13: closing mid-Apply did not cancel the PATCH and unmounted
  // the only surface that shows its error — a live-listing revise could land
  // after the seller believed they cancelled.
  it("ignores backdrop click and Escape while an Apply is in flight", () => {
    const onClose = vi.fn();
    const { container } = render(<RescanDiffSheet rows={rows} busy onApply={vi.fn()} onClose={onClose} />);
    fireEvent.click(container.querySelector(".bg-black\\/50")!);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables Cancel while an Apply is in flight, same as Apply", () => {
    render(<RescanDiffSheet rows={rows} busy onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  // Reviewer 2026-09-13: aria-modal without a focus trap let Tab escape to the
  // page behind the overlay (ConfirmSheet traps; this sheet must too, and it
  // has checkboxes ConfirmSheet does not).
  it("traps Tab: wraps from the last button back to the first focusable control", () => {
    render(<RescanDiffSheet rows={rows} onApply={vi.fn()} onClose={vi.fn()} />);
    const apply = screen.getByRole("button", { name: "Apply 1 change" });
    apply.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(screen.getByRole("checkbox", { name: "Select all" })).toHaveFocus();
  });

  it("disables Apply while busy and renders a failure inside the sheet", () => {
    render(<RescanDiffSheet rows={rows} busy error="Couldn't save" onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Applying…" })).toBeDisabled();
    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
  });
});
