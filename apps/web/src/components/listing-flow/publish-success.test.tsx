import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublishSuccess } from "./publish-success";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProps = {
  listingId: "L1",
  marketplace: "ebay" as const,
  title: "Mic Kit",
  price: 65,
  photoUrl: null,
  isFirstListing: false,
  onListAnother: vi.fn(),
};

describe("PublishSuccess draft-fallback warning", () => {
  it("shows the marketplace's reason and a draft heading when publish fell back to draft", () => {
    render(
      <PublishSuccess
        {...baseProps}
        warning="Listing created as draft — publish to eBay failed: account locked"
      />,
    );

    expect(screen.getByText(/account locked/)).toBeInTheDocument();
    expect(screen.getByText("Saved as draft")).toBeInTheDocument();
    expect(screen.queryByText("Listed!")).not.toBeInTheDocument();
  });

  it("keeps the clean success state when there is no warning", () => {
    render(<PublishSuccess {...baseProps} />);

    expect(screen.getByText("Listed!")).toBeInTheDocument();
    expect(screen.queryByText("Saved as draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
