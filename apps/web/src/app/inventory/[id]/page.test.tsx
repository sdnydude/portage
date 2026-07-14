import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  item: {
    id: "i1", userId: "u1", title: "Canon AE-1", description: "d", category: "electronics",
    condition: "good", conditionNotes: "", brand: "Canon", model: "AE-1", features: [],
    photos: [] as { url: string; key?: string; isPrimary?: boolean; width?: number; height?: number }[],
    estimatedValueMin: null, estimatedValueMax: null, estimatedValueRecommended: null,
    price: null as number | null,
    aiConfidenceScore: 0, quantity: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  },
  updateItem: vi.fn().mockResolvedValue({}),
  apiMock: vi.fn(),
  enhanceResult: null as null | { image: { key: string; url: string; width: number; height: number; size: number } },
  enhanceProcessing: false,
}));

const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "i1" }),
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => mockSearchParams,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));
vi.mock("@/hooks/use-item", () => ({
  useItem: () => ({
    item: h.item,
    isLoading: false, error: null, deleteItem: vi.fn(), updateItem: h.updateItem,
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: h.apiMock,
}));
vi.mock("@/hooks/use-enhance", () => ({
  useEnhance: () => ({ isProcessing: h.enhanceProcessing, result: h.enhanceResult, error: null, enhance: vi.fn(), reset: vi.fn() }),
}));
vi.mock("@/hooks/use-comps", () => ({
  useComps: () => ({ comps: null, isLoading: false, error: null, fetchComps: vi.fn() }),
}));
import type { Listing } from "@/hooks/use-listings";
let mockListings: Listing[] = [];
let mockListingsLoading = false;
let mockListingsError: string | null = null;
const refetchListingsMock = vi.fn();
vi.mock("@/hooks/use-listings", () => ({
  useListings: () => ({ listings: mockListings, isLoading: mockListingsLoading, error: mockListingsError, refetch: refetchListingsMock, createListing: vi.fn() }),
}));
vi.mock("@/components/image/before-after-slider", () => ({ BeforeAfterSlider: () => null }));
vi.mock("@/components/capture/image-picker", () => ({ ImagePicker: () => null }));
vi.mock("@/components/listing-flow/crop-tool", () => ({
  CropTool: ({ onApply }: { onApply: (c: { x: number; y: number; width: number; height: number }) => void }) => (
    <button onClick={() => onApply({ x: 1, y: 2, width: 30, height: 40 })}>apply-crop</button>
  ),
}));
vi.mock("@/components/listing/create-listing-sheet", () => ({
  CreateListingSheet: ({ suggestedPrice, allowedMarketplaces, onCreated }: { suggestedPrice?: number; allowedMarketplaces?: string[]; onCreated: () => void }) => (
    <div>
      sheet-open price:{suggestedPrice ?? "none"} allowed:{allowedMarketplaces ? allowedMarketplaces.join(",") : "all"}
      <button onClick={onCreated}>finish-create</button>
    </div>
  ),
}));

vi.mock("@/components/listing/listing-optimizer-panel", () => ({
  ListingOptimizerPanel: ({ itemId }: { itemId: string }) => <div>optimizer:{itemId}</div>,
}));

import ItemDetailPage from "./page";

// jsdom has no scrollIntoView; the deep-link test installs one. Capture
// whatever is there so every test starts from the same prototype state.
const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
afterEach(() => {
  mockListings = [];
  mockListingsLoading = false;
  mockListingsError = null;
  mockSearchParams = new URLSearchParams();
  refetchListingsMock.mockClear();
  pushMock.mockClear();
  window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

describe("inventory detail — editable price", () => {
  it("routes Edit to the canonical /edit page (no inline static-category editor)", () => {
    render(<ItemDetailPage />);
    fireEvent.click(screen.getByLabelText("Edit item"));
    // Editing now navigates to the eBay-taxonomy edit page; the deprecated inline
    // editor (static category/condition lists, no persisted categoryId) is gone.
    expect(pushMock).toHaveBeenCalledWith("/inventory/i1/edit");
    expect(screen.queryByLabelText("Price (USD)")).not.toBeInTheDocument();
  });

  it("has no silent quick-list button and opens the publish sheet prefilled from the item price", () => {
    h.item.price = 75;
    render(<ItemDetailPage />);
    // The silent "List for Sale" quick-publish path is gone — all publishing
    // goes through the price-confirming sheet.
    expect(screen.queryByText("List for Sale")).toBeNull();
    fireEvent.click(screen.getByText("List on Marketplace"));
    expect(screen.getByText(/sheet-open price:75/)).toBeInTheDocument();
  });

  it("after creating a listing from the sheet, stays on the page and refetches listings", () => {
    pushMock.mockClear();
    refetchListingsMock.mockClear();
    render(<ItemDetailPage />);
    fireEvent.click(screen.getByText("List on Marketplace"));
    fireEvent.click(screen.getByText("finish-create"));
    // Listing-hub contract: the new card appears in place — no redirect.
    expect(pushMock).not.toHaveBeenCalledWith("/inventory");
    expect(refetchListingsMock).toHaveBeenCalled();
  });

  it("renders the Listing Optimizer panel for the item", () => {
    render(<ItemDetailPage />);
    expect(screen.getByText("optimizer:i1")).toBeInTheDocument();
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
    // S2.5-6: item detail hosts all 4 tools (rotate/crop plumbing ported from scan-flow).
    expect(screen.getByRole("button", { name: /rotate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crop/i })).toBeInTheDocument();
  });

  it("rotate posts /images/rotate and persists the rotated photo entry", async () => {
    h.item.photos = [{ url: "https://example.com/1.jpg", key: "k1" }] as never;
    h.updateItem.mockClear();
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-rot", url: "https://example.com/1-rot.jpg", width: 800, height: 600 },
    });
    render(<ItemDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /rotate/i }));

    await waitFor(() => {
      expect(h.apiMock).toHaveBeenCalledWith("/images/rotate", expect.objectContaining({
        method: "POST",
        body: { imageUrl: "https://example.com/1.jpg", degrees: 90 },
      }));
      expect(h.updateItem).toHaveBeenCalledWith({
        photos: [{ url: "https://example.com/1-rot.jpg", key: "k1-rot", width: 800, height: 600 }],
      });
    });
  });

  it("accepting an enhance writes the edited photo's slot, not another photo's (multi-photo)", async () => {
    h.item.photos = [
      { url: "https://example.com/1.jpg", key: "k1" },
      { url: "https://example.com/2.jpg", key: "k2" },
    ] as never;
    h.updateItem.mockClear();
    h.enhanceResult = { image: { key: "k2-enh", url: "https://example.com/2-enh.jpg", width: 9, height: 9, size: 1 } };
    try {
      render(<ItemDetailPage />);
      fireEvent.click(screen.getByRole("button", { name: /edit photo 2/i }));
      fireEvent.click(screen.getByRole("button", { name: /use this photo/i }));

      await waitFor(() => {
        expect(h.updateItem).toHaveBeenCalledWith({
          photos: [
            { url: "https://example.com/1.jpg", key: "k1" },
            { url: "https://example.com/2-enh.jpg", key: "k2-enh" },
          ],
        });
      });
    } finally {
      h.enhanceResult = null;
    }
  });

  it("a failed rotate surfaces its error inside the editor overlay (page error UI sits beneath it)", async () => {
    h.item.photos = [{ url: "https://example.com/1.jpg", key: "k1" }] as never;
    h.apiMock.mockRejectedValueOnce(new Error("rotate exploded"));
    render(<ItemDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /rotate/i }));

    // The page-body uploadError div sits beneath the fixed z-[70] overlay, so
    // the error must render INSIDE the overlay to be visible.
    const errorNodes = await screen.findAllByText("rotate exploded");
    expect(errorNodes.some((n) => n.closest('[class*="z-[70]"]'))).toBe(true);
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
  });

  it("BG Remove runs inline from the editor (no interstitial CTA page) and accepting persists", async () => {
    h.item.photos = [{ url: "https://example.com/1.jpg", key: "k1" }] as never;
    h.updateItem.mockClear();
    h.apiMock.mockClear();
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/images/remove-bg") {
        return { image: { key: "k1-bg", url: "https://example.com/1-bg.jpg", size: 9 } };
      }
      return {};
    });
    render(<ItemDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /bg remove/i }));

    // The tool starts immediately — no second "Remove Background" CTA screen.
    expect(screen.queryByRole("button", { name: /remove background/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(h.apiMock).toHaveBeenCalledWith("/images/remove-bg", expect.objectContaining({
        method: "POST",
        body: { imageUrl: "https://example.com/1.jpg" },
      }));
    });

    // Result surfaces as the editor's accept/discard preview; accepting persists.
    fireEvent.click(await screen.findByRole("button", { name: /use this photo/i }));
    await waitFor(() => {
      expect(h.updateItem).toHaveBeenCalledWith({
        photos: [{ url: "https://example.com/1-bg.jpg", key: "k1-bg" }],
      });
    });
  });

  it("Exposure opens the EV slider overlay; applying posts /images/exposure and persists", async () => {
    h.item.photos = [{ url: "https://example.com/1.jpg", key: "k1" }] as never;
    h.updateItem.mockClear();
    h.apiMock.mockClear();
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-ev", url: "https://example.com/1-ev.jpg", width: 50, height: 50 },
    });
    render(<ItemDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /exposure/i }));

    fireEvent.change(screen.getByRole("slider"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(h.apiMock).toHaveBeenCalledWith("/images/exposure", expect.objectContaining({
        method: "POST",
        body: { imageUrl: "https://example.com/1.jpg", ev: 1 },
      }));
      expect(h.updateItem).toHaveBeenCalledWith({
        photos: [{ url: "https://example.com/1-ev.jpg", key: "k1-ev", width: 50, height: 50 }],
      });
    });
  });

  it("crop opens the crop overlay; applying posts /images/crop and persists", async () => {
    h.item.photos = [{ url: "https://example.com/1.jpg", key: "k1" }] as never;
    h.updateItem.mockClear();
    h.apiMock.mockClear();
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-crop", url: "https://example.com/1-crop.jpg", width: 30, height: 40 },
    });
    render(<ItemDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /^crop$/i }));
    fireEvent.click(screen.getByText("apply-crop"));

    await waitFor(() => {
      expect(h.apiMock).toHaveBeenCalledWith("/images/crop", expect.objectContaining({
        method: "POST",
        body: { imageUrl: "https://example.com/1.jpg", crop: { x: 1, y: 2, width: 30, height: 40 } },
      }));
      expect(h.updateItem).toHaveBeenCalledWith({
        photos: [{ url: "https://example.com/1-crop.jpg", key: "k1-crop", width: 30, height: 40 }],
      });
    });
  });
});

describe("marketplace listings section", () => {
  it("renders the Marketplace Listings heading and a card when the item has a listing", () => {
    mockListings = [{
      id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: "307054605978", marketplaceSpecificFields: null,
      status: "active", price: 1200, currency: "USD",
      createdAt: "2026-07-10T17:24:31Z", publishedAt: "2026-07-10T17:24:33Z",
      soldAt: null, itemTitle: "Canon AE-1",
    }];
    render(<ItemDetailPage />);
    expect(screen.getByText("Marketplace Listings")).toBeInTheDocument();
    expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();
  });

  it("hides the primary CTA while listings are loading or errored (duplicate-listing guard)", () => {
    mockListingsLoading = true;
    const { unmount } = render(<ItemDetailPage />);
    expect(screen.queryByText("List on Marketplace")).toBeNull();
    unmount();

    mockListingsLoading = false;
    mockListingsError = "network down";
    render(<ItemDetailPage />);
    expect(screen.queryByText("List on Marketplace")).toBeNull();
    mockListingsError = null;
  });

  it("deep link to an archived listing auto-expands the archive section and scrolls to it", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockSearchParams = new URLSearchParams("listing=la1");
    mockListings = [{
      id: "la1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: null, marketplaceSpecificFields: null,
      status: "archived", price: 500, currency: "USD",
      createdAt: "2026-07-01T00:00:00Z", publishedAt: null,
      soldAt: null, itemTitle: "Canon AE-1",
    }];
    try {
      render(<ItemDetailPage />);
      // The effect must expand the collapsed archive section so the card can
      // enter the DOM, then scroll to it.
      await waitFor(() => expect(screen.getByText("Hide archived")).toBeInTheDocument());
      await waitFor(() =>
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled(),
      );
    } finally {
      mockSearchParams = new URLSearchParams();
    }
  });

  it("threads the item's brand/model into the card's aspect-sheet prefill", async () => {
    mockListings = [{
      id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: null, marketplaceSpecificFields: null,
      status: "draft", price: 75, currency: "USD",
      createdAt: "2026-07-10T17:24:31Z", publishedAt: null,
      soldAt: null, itemTitle: "Canon AE-1",
    }];
    const { ApiError } = await import("@/lib/api");
    h.apiMock.mockImplementation(async (path: string) => {
      if (String(path).includes("/publish")) {
        throw new ApiError(422, "EBAY_ASPECTS_REQUIRED", "aspects", [
          { name: "Brand", required: true } as never,
        ]);
      }
      return path === "/seller-profile" ? { profile: {} } : {};
    });
    render(<ItemDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: /publish to ebay/i }));
    // The sheet must open prefilled with the item's brand — the card doesn't
    // hold the item, so the page threads itemBrand/itemModel down.
    expect(await screen.findByDisplayValue("Canon")).toBeInTheDocument();
  });

  it("Preview listing CTA routes to the share preview page", () => {
    render(<ItemDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: /preview listing/i }));
    expect(pushMock).toHaveBeenCalledWith("/inventory/i1/preview");
  });

  it("cross-list CTA restricts the sheet to marketplaces without a non-archived listing", () => {
    mockListings = [{
      id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: "307054605978", marketplaceSpecificFields: null,
      status: "active", price: 1200, currency: "USD",
      createdAt: "2026-07-10T17:24:31Z", publishedAt: "2026-07-10T17:24:33Z",
      soldAt: null, itemTitle: "Canon AE-1",
    }];
    render(<ItemDetailPage />);
    fireEvent.click(screen.getByText(/List on another marketplace/));
    expect(screen.getByText(/allowed:reverb/)).toBeInTheDocument();
  });
});

describe("photo reorder + delete (F1+F2)", () => {
  const threePhotos = () => [
    { url: "https://r2.example/a.jpg", key: "ka", isPrimary: true },
    { url: "https://r2.example/b.jpg", key: "kb", isPrimary: false },
    { url: "https://r2.example/c.jpg", key: "kc", isPrimary: false },
  ];

  it("drag reorder in the strip commits ONE PATCH with the normalized order on release", () => {
    vi.useFakeTimers();
    try {
      h.item.photos = threePhotos();
      h.updateItem.mockClear();
      render(<ItemDetailPage />);
      const thumb1 = screen.getByRole("button", { name: /edit photo 1/i });
      fireEvent.pointerDown(thumb1, { clientX: 10, clientY: 10 });
      vi.advanceTimersByTime(500);
      document.elementFromPoint = vi
        .fn()
        .mockReturnValue(screen.getByRole("button", { name: /edit photo 3/i }));
      fireEvent.pointerMove(thumb1, { clientX: 200, clientY: 10 });
      // Live move — nothing persisted yet.
      expect(h.updateItem).not.toHaveBeenCalled();
      fireEvent.pointerUp(thumb1);
      expect(h.updateItem).toHaveBeenCalledTimes(1);
      expect(h.updateItem).toHaveBeenCalledWith({
        photos: [
          { url: "https://r2.example/b.jpg", key: "kb", isPrimary: true },
          { url: "https://r2.example/c.jpg", key: "kc", isPrimary: false },
          { url: "https://r2.example/a.jpg", key: "ka", isPrimary: false },
        ],
      });
    } finally {
      vi.useRealTimers();
      h.item.photos = [];
    }
  });

  it("deleting a photo in the manage sheet PATCHes the remaining photos with isPrimary renormalized", async () => {
    try {
      h.item.photos = threePhotos();
      h.updateItem.mockClear();
      render(<ItemDetailPage />);
      fireEvent.click(screen.getByRole("button", { name: /manage photos/i }));
      fireEvent.click(screen.getByRole("button", { name: /delete photo 1/i }));
      await waitFor(() =>
        expect(h.updateItem).toHaveBeenCalledWith({
          photos: [
            { url: "https://r2.example/b.jpg", key: "kb", isPrimary: true },
            { url: "https://r2.example/c.jpg", key: "kc", isPrimary: false },
          ],
        }),
      );
    } finally {
      h.item.photos = [];
    }
  });

  it("blocks deleting the last photo while a listing is live, with an explanatory error", async () => {
    try {
      h.item.photos = [{ url: "https://r2.example/a.jpg", key: "ka", isPrimary: true }];
      h.updateItem.mockClear();
      mockListings = [{
        id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
        marketplaceListingId: "307054605978", marketplaceSpecificFields: null,
        status: "active", price: 1200, currency: "USD",
        createdAt: "2026-07-10T17:24:31Z", publishedAt: "2026-07-10T17:24:33Z",
        soldAt: null, itemTitle: "Canon AE-1",
      }];
      render(<ItemDetailPage />);
      fireEvent.click(screen.getByRole("button", { name: /manage photos/i }));
      fireEvent.click(screen.getByRole("button", { name: /delete photo 1/i }));
      expect(await screen.findByText(/last photo/i)).toBeInTheDocument();
      expect(h.updateItem).not.toHaveBeenCalled();
    } finally {
      h.item.photos = [];
    }
  });

  it("locks reorder while a photo tool is processing (no manage affordance)", () => {
    try {
      h.item.photos = threePhotos();
      h.enhanceProcessing = true;
      render(<ItemDetailPage />);
      expect(screen.queryByRole("button", { name: /manage photos/i })).not.toBeInTheDocument();
    } finally {
      h.enhanceProcessing = false;
      h.item.photos = [];
    }
  });
});
