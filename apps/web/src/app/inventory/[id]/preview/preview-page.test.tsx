import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toBlobMock = vi.fn();
vi.mock("html-to-image", () => ({ toBlob: (...args: unknown[]) => toBlobMock(...args) }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "i1" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t", isAuthenticated: true }) }));
vi.mock("@/hooks/use-item", () => ({
  useItem: () => ({
    item: {
      id: "i1", title: "Sony WH-1000XM4", description: "Great cans", condition: "good",
      photos: [], price: 75,
      estimatedValueRecommended: null, estimatedValueMin: null, estimatedValueMax: null,
    },
    isLoading: false, error: null,
  }),
}));
vi.mock("@/hooks/use-listings", () => ({
  useListings: () => ({
    listings: [{ id: "l1", itemId: "i1", marketplace: "ebay", status: "active", price: 1200, currency: "USD" }],
    isLoading: false, error: null, refetch: vi.fn(), createListing: vi.fn(),
  }),
}));

import PreviewPage from "./page";

beforeEach(() => {
  toBlobMock.mockReset();
});

describe("inventory/[id]/preview — PNG share", () => {
  it("shares the captured card as a PNG File via navigator.share when canShare", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    toBlobMock.mockResolvedValue(blob);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { canShare: () => true, share });

    render(<PreviewPage />);
    // Active listing's price wins over the item-price fallback chain.
    expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const arg = share.mock.calls[0][0] as { files: File[] };
    expect(arg.files[0].type).toBe("image/png");
  });
});
