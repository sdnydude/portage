import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditItemPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "i1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
}));

const updateItemMock = vi.fn().mockResolvedValue({});
// Stable identity — a fresh object per render would retrigger the page's
// item-seeding effect forever.
const ITEM = {
  id: "i1",
  title: "Mic Kit",
  description: "d",
  category: "electronics",
  condition: "new",
  conditionNotes: "",
  brand: "Sennheiser",
  model: "MKE 200",
  quantity: 1,
  price: 65,
  weightOz: 24,
  lengthIn: null,
  widthIn: null,
  heightIn: null,
  ebayPackageType: null,
  weightEstimated: false,
  photos: [],
};
vi.mock("@/hooks/use-item", () => ({
  useItem: () => ({
    item: ITEM,
    isLoading: false,
    error: null,
    updateItem: updateItemMock,
  }),
}));

const scanAspectsState = {
  resolvedCategoryId: "29946",
  resolvedCategoryName: "Microphones & Wireless Systems",
  conditionIds: [] as string[],
  isCategoryResolving: false,
  isAspectsLoading: false,
  aspects: {},
  aspectValues: {},
  setAspectValue: vi.fn(),
  suggestions: {},
  confirmSuggestion: vi.fn(),
  missingRequired: [],
  buildAspects: vi.fn(() => ({})),
  aspectsBlockPublish: false,
  resolveCategory: vi.fn(),
};
vi.mock("@/hooks/use-scan-aspects", () => ({
  useScanAspects: () => scanAspectsState,
}));

let mockEditListings: Array<{ status: string }> = [];
vi.mock("@/hooks/use-listings", () => ({
  useListings: () => ({ listings: mockEditListings, isLoading: false, error: null, refetch: vi.fn(), createListing: vi.fn() }),
}));

beforeEach(() => {
  updateItemMock.mockClear();
});

describe("EditItemPage — shared-fields notice (listing-hub)", () => {
  it("shows the cross-marketplace copy when the item has a non-archived listing", () => {
    mockEditListings = [{ status: "active" }];
    try {
      render(<EditItemPage />);
      expect(screen.getByText(/shared across marketplaces/i)).toBeInTheDocument();
    } finally {
      mockEditListings = [];
    }
  });
});

describe("EditItemPage — eBay taxonomy category + price", () => {
  it("price-only save keeps the STORED category (auto-resolution never silently overwrites)", async () => {
    render(<EditItemPage />);

    // The deprecated 13-value static list is gone
    expect(screen.queryByRole("option", { name: "Furniture" })).not.toBeInTheDocument();

    // Price is editable
    const price = screen.getByLabelText("Price (USD)");
    expect(price).toHaveValue("65");
    fireEvent.change(price, { target: { value: "80" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updateItemMock).toHaveBeenCalledTimes(1));
    expect(updateItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 80,
        // user never touched the category — the stored value survives
        category: "electronics",
      }),
    );
  });

  it("saves the eBay category only after the seller explicitly resolves it", async () => {
    render(<EditItemPage />);

    fireEvent.change(screen.getByLabelText("Search eBay category"), {
      target: { value: "studio microphones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find category" }));
    expect(scanAspectsState.resolveCategory).toHaveBeenCalledWith("studio microphones");

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updateItemMock).toHaveBeenCalledTimes(1));
    expect(updateItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "Microphones & Wireless Systems",
        // The resolved eBay LEAF id must persist too — name alone doesn't let
        // publish resolve the category (it would fall back to a title guess).
        marketplaceData: {
          ebay: { categoryId: "29946", categoryName: "Microphones & Wireless Systems" },
        },
      }),
    );
  });

  it("constrains the Condition options to the resolved category's conditionIds", () => {
    // A new-only category (1000/1500 satisfy only the "new" chain)
    scanAspectsState.conditionIds = ["1000", "1500"];

    render(<EditItemPage />);

    expect(screen.getByRole("option", { name: "New" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Good" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Poor" })).not.toBeInTheDocument();

    scanAspectsState.conditionIds = [];
  });
});
