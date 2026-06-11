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

beforeEach(() => {
  updateItemMock.mockClear();
});

describe("EditItemPage — eBay taxonomy category + price", () => {
  it("replaces the static category list with the eBay category and saves price + eBay name", async () => {
    render(<EditItemPage />);

    // The deprecated 13-value static list is gone
    expect(screen.queryByRole("option", { name: "Furniture" })).not.toBeInTheDocument();
    // The resolved eBay category is THE category
    expect(screen.getByText("Microphones & Wireless Systems")).toBeInTheDocument();

    // Price is editable
    const price = screen.getByLabelText("Price (USD)");
    expect(price).toHaveValue("65");
    fireEvent.change(price, { target: { value: "80" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updateItemMock).toHaveBeenCalledTimes(1));
    expect(updateItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 80,
        category: "Microphones & Wireless Systems",
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
