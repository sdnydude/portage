import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditItemPage from "./page";

const routerBack = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "i1" }),
  useRouter: () => ({ push: vi.fn(), back: routerBack, replace: vi.fn() }),
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
  categoryMismatch: false,
  resolvedVisionCategory: "electronics" as string | undefined,
  dismissCategoryMismatch: vi.fn(),
  clearCategoryResolution: vi.fn(),
};
vi.mock("@/hooks/use-scan-aspects", () => ({
  useScanAspects: () => scanAspectsState,
}));

let mockEditListings: Array<{ status: string }> = [];
let mockEditListingsLoading = false;
vi.mock("@/hooks/use-listings", () => ({
  useListings: () => ({ listings: mockEditListings, isLoading: mockEditListingsLoading, error: null, refetch: vi.fn(), createListing: vi.fn() }),
}));

beforeEach(() => {
  updateItemMock.mockClear();
  updateItemMock.mockResolvedValue({});
  routerBack.mockClear();
});

describe("EditItemPage — marketplace sync warnings (P3 T4)", () => {
  it("stays on the page and shows the warning instead of navigating back when the save returns syncWarnings", async () => {
    updateItemMock.mockResolvedValueOnce({ ...ITEM, price: 80, syncWarnings: ["ebay: listing 1100 — The Best Offer auto-accept price $85 must be a positive amount below the listing price $80"] });
    render(<EditItemPage />);
    fireEvent.change(screen.getByLabelText("Price (USD)"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updateItemMock).toHaveBeenCalledTimes(1));
    const notice = await screen.findByTestId("sync-warning");
    expect(notice).toHaveTextContent(/auto-accept price \$85/);
    expect(notice).toHaveTextContent(/saved/i);
    expect(routerBack).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /fix offer settings/i })).toHaveAttribute("href", "/inventory/i1");
  });
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

describe("EditItemPage — condition notes (Housekeeping-1 T9)", () => {
  it("renders Condition Notes as a 5-row textarea capped at 2000 chars (matches the server cap)", () => {
    render(<EditItemPage />);
    const notes = screen.getByPlaceholderText(/scratches, wear, defects/i) as HTMLTextAreaElement;
    expect(notes.tagName).toBe("TEXTAREA");
    expect(notes.rows).toBe(5);
    expect(notes.maxLength).toBe(2000);
  });
});

describe("EditItemPage — item status (Housekeeping-1 T6)", () => {
  it("saves a manual status change, and locks the control to Active when a live listing exists", async () => {
    updateItemMock.mockClear();
    const { unmount } = render(<EditItemPage />);
    const select = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    fireEvent.change(select, { target: { value: "asset" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateItemMock).toHaveBeenCalledTimes(1));
    expect(updateItemMock).toHaveBeenCalledWith(expect.objectContaining({ status: "asset" }));
    unmount();

    mockEditListings = [{ status: "active" }];
    try {
      render(<EditItemPage />);
      const locked = screen.getByLabelText("Status") as HTMLSelectElement;
      expect(locked.disabled).toBe(true);
      expect(locked.value).toBe("active");
    } finally {
      mockEditListings = [];
    }
  });
});

describe("EditItemPage — item status, remaining lock branches (review)", () => {
  it("locks to Draft / Sold from listings and stays disabled while listings are still loading", () => {
    for (const [status, expected] of [["draft", "draft"], ["sold", "sold"]] as const) {
      mockEditListings = [{ status }];
      const { unmount } = render(<EditItemPage />);
      const locked = screen.getByLabelText("Status") as HTMLSelectElement;
      expect(locked.disabled).toBe(true);
      expect(locked.value).toBe(expected);
      unmount();
    }
    mockEditListings = [];
    mockEditListingsLoading = true;
    try {
      render(<EditItemPage />);
      expect((screen.getByLabelText("Status") as HTMLSelectElement).disabled).toBe(true);
    } finally {
      mockEditListingsLoading = false;
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

  it("shows the mismatch banner when a resolution is implausible for the item's scanned kind", () => {
    scanAspectsState.categoryMismatch = true;
    try {
      render(<EditItemPage />);
      expect(screen.getByText(/Double-check this category/)).toBeInTheDocument();
    } finally {
      scanAspectsState.categoryMismatch = false;
    }
  });

  it("Don't use it on the edit page rejects the suggestion via clearCategoryResolution", () => {
    scanAspectsState.categoryMismatch = true;
    try {
      render(<EditItemPage />);
      fireEvent.click(screen.getByRole("button", { name: "Don't use it" }));
      expect(scanAspectsState.clearCategoryResolution).toHaveBeenCalled();
    } finally {
      scanAspectsState.categoryMismatch = false;
    }
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
