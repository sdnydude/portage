import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BulkActionBar } from "./bulk-action-bar";

describe("BulkActionBar", () => {
  it("renders the Category action on the legible amber-700 shade (operator: tags unreadable in light mode, 2026-09-06)", () => {
    render(
      <BulkActionBar
        selectedCount={2}
        totalCount={5}
        onSelectAll={vi.fn()}
        onClear={vi.fn()}
        onDelete={vi.fn()}
        onUpdateCategory={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Update category" })).toHaveClass("text-amber-700");
  });
});
