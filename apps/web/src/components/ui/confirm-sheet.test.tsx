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

  // F6: dialog-in-name-only — a modal must actually manage focus.
  it("moves focus into the sheet when it opens", () => {
    render(
      <ConfirmSheet
        title="Delete Item"
        body="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ConfirmSheet
        title="Delete Item"
        body="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("traps Tab: wraps from the last button back to the first", () => {
    render(
      <ConfirmSheet
        title="Delete Item"
        body="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Delete" });
    confirm.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("restores focus to the invoking element on close", () => {
    const invoker = document.createElement("button");
    invoker.textContent = "open sheet";
    document.body.appendChild(invoker);
    invoker.focus();
    const { unmount } = render(
      <ConfirmSheet
        title="Delete Item"
        body="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(invoker).not.toHaveFocus();
    unmount();
    expect(invoker).toHaveFocus();
    invoker.remove();
  });

  it("exposes the sheet panel as a modal dialog containing the confirm button", () => {
    render(
      <ConfirmSheet
        title="Delete Item"
        body="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(screen.getByRole("button", { name: "Delete" }));
  });
});
