import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const h = vi.hoisted(() => ({
  item: {
    id: "i1", userId: "u1", title: "Canon AE-1", description: "d", category: "electronics",
    condition: "good", conditionNotes: "", brand: "Canon", model: "AE-1", features: [], photos: [],
    estimatedValueMin: null, estimatedValueMax: null, estimatedValueRecommended: null,
    price: null as number | null,
    aiConfidenceScore: 0, quantity: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "i1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));
vi.mock("@/hooks/use-item", () => ({
  useItem: () => ({
    item: h.item,
    isLoading: false, error: null, deleteItem: vi.fn(), updateItem: vi.fn().mockResolvedValue({}),
  }),
}));
vi.mock("@/hooks/use-enhance", () => ({
  useEnhance: () => ({ isProcessing: false, result: null, error: null, enhance: vi.fn(), reset: vi.fn() }),
}));
vi.mock("@/hooks/use-comps", () => ({
  useComps: () => ({ comps: null, isLoading: false, error: null, fetchComps: vi.fn() }),
}));
vi.mock("@/hooks/use-listings", () => ({ useListings: () => ({ createListing: vi.fn() }) }));
vi.mock("@/components/image/bg-removal-panel", () => ({ BgRemovalPanel: () => null }));
vi.mock("@/components/image/before-after-slider", () => ({ BeforeAfterSlider: () => null }));
vi.mock("@/components/capture/image-picker", () => ({ ImagePicker: () => null }));
vi.mock("@/components/listing/create-listing-sheet", () => ({
  CreateListingSheet: ({ suggestedPrice }: { suggestedPrice?: number }) => (
    <div>sheet-open price:{suggestedPrice ?? "none"}</div>
  ),
}));

import ItemDetailPage from "./page";

describe("inventory detail — editable price", () => {
  it("shows the editable Price field when editing the item", () => {
    h.item.price = null;
    render(<ItemDetailPage />);
    fireEvent.click(screen.getByLabelText("Edit item"));
    expect(screen.getByLabelText("Price (USD)")).toBeInTheDocument();
  });

  it("has no silent quick-list button and opens the publish sheet prefilled from the item price", () => {
    h.item.price = 75;
    render(<ItemDetailPage />);
    // The silent "List for Sale" quick-publish path is gone — all publishing
    // goes through the price-confirming sheet.
    expect(screen.queryByText("List for Sale")).toBeNull();
    fireEvent.click(screen.getByText("List on Marketplace"));
    expect(screen.getByText("sheet-open price:75")).toBeInTheDocument();
  });
});

describe("inventory detail — photo gallery strip + editor overlay", () => {
  it("renders the gallery strip instead of the inline tools; tapping a thumb opens the editor", () => {
    h.item.photos = [
      { url: "https://example.com/1.jpg", key: "k1", isPrimary: true },
      { url: "https://example.com/2.jpg", key: "k2" },
    ] as never;
    render(<ItemDetailPage />);

    expect(screen.getByText(/photos · 2/i)).toBeInTheDocument();
    // The always-on tool buttons are gone from the page body.
    expect(screen.queryByText(/auto-enhance/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bg remove/i })).toBeInTheDocument();
    // No rotate/crop plumbing on this page.
    expect(screen.queryByRole("button", { name: /rotate/i })).not.toBeInTheDocument();
  });
});
