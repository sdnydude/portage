import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("./disclaimer-sheet", () => ({ DisclaimerSheet: () => null }));

import { CreateListingSheet } from "./create-listing-sheet";

describe("CreateListingSheet — price prefill", () => {
  it("keeps the price input in sync when suggestedPrice resolves after mount", () => {
    const noop = () => {};
    const { rerender } = render(
      <CreateListingSheet itemId="i1" suggestedPrice={10} onCreated={noop} onClose={noop} />,
    );
    const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(input.value).toBe("10");

    // comps resolve later → suggestedPrice changes; the field must follow.
    rerender(<CreateListingSheet itemId="i1" suggestedPrice={20} onCreated={noop} onClose={noop} />);
    expect(input.value).toBe("20");
  });
});
