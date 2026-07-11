import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingCard } from "./listing-card";

const LISTING = {
  id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay" as const,
  marketplaceListingId: "307054605978", marketplaceSpecificFields: null,
  status: "active" as const, price: 1200, currency: "USD",
  createdAt: "2026-07-10T17:24:31Z", publishedAt: "2026-07-10T17:24:33Z",
  soldAt: null, itemTitle: "ASUS ROG",
};

describe("ListingCard (read-only)", () => {
  it("shows marketplace, status pill, and price", () => {
    render(<ListingCard listing={LISTING} token="t" onChanged={() => {}} highlight={false} />);
    expect(screen.getAllByText(/ebay/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();
  });

  it("links to the live marketplace listing", () => {
    render(<ListingCard listing={LISTING} token="t" onChanged={() => {}} highlight={false} />);
    const link = screen.getByRole("link", { name: /view on ebay/i });
    expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/307054605978");
  });
});
