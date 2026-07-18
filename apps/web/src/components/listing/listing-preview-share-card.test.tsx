import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingPreviewShareCard } from "./listing-preview-share-card";

const MOCK_ITEM = {
  id: "i1",
  title: "Sony WH-1000XM4",
  description: "Premium noise-cancelling headphones in excellent shape, barely used.",
  condition: "good",
  photos: [{ key: "items/u1/2026/07/10/a.jpg", url: "https://r2.example/a.jpg", isPrimary: true }],
};

describe("ListingPreviewShareCard", () => {
  it("renders title, price, condition, and the same-origin proxied hero photo", () => {
    render(<ListingPreviewShareCard item={MOCK_ITEM} price={1200} />);
    expect(screen.getByText("Sony WH-1000XM4")).toBeInTheDocument();
    expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();
    expect(screen.getByText(/good/i)).toBeInTheDocument();
    const img = screen.getByRole("img");
    // Same-origin via the app's /img-cdn rewrite (next.config reverse proxy to
    // the R2 public domain) — a raw R2 URL would taint the PNG canvas.
    expect(img).toHaveAttribute("src", "/img-cdn/items/u1/2026/07/10/a.jpg");
    expect(img).toHaveAttribute("crossorigin", "anonymous");
  });
});
