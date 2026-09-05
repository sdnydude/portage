import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BestOfferFloorNote } from "./best-offer-floor-note";

describe("BestOfferFloorNote (BO-5)", () => {
  it("shows the AI-prepared auto-accept floor with its value and clears it on request", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<BestOfferFloorNote floor={85} onClear={onClear} />);

    expect(screen.getByText(/auto-accept/i)).toBeInTheDocument();
    expect(screen.getByText(/\$85/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
