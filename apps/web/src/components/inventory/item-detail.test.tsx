import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  item: {
    id: "i1", userId: "u1", title: "Canon AE-1", description: "d", category: "electronics",
    condition: "good", conditionNotes: "", brand: "Canon", model: "AE-1", features: [],
    photos: [] as { url: string; key?: string; isPrimary?: boolean; width?: number; height?: number }[],
    estimatedValueMin: null, estimatedValueMax: null, estimatedValueRecommended: null,
    price: null as number | null,
    aiConfidenceScore: 0, quantity: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  },
  itemError: null as string | null,
  updateItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue({}),
  refetchItem: vi.fn(),
  apiMock: vi.fn(),
  apiUploadMock: vi.fn(),
  enhanceResult: null as null | { image: { key: string; url: string; width: number; height: number; size: number } },
  enhanceProcessing: false,
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/inventory/i1",
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t", user: { email: "s@x.com" } }) }));
vi.mock("@/hooks/use-item", () => ({
  useItem: () => ({
    item: h.itemError ? null : h.item,
    isLoading: false, error: h.itemError, deleteItem: h.deleteItem, updateItem: h.updateItem, refetch: h.refetchItem,
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: h.apiMock,
  apiUpload: h.apiUploadMock,
}));
vi.mock("@/hooks/use-enhance", () => ({
  useEnhance: () => ({ isProcessing: h.enhanceProcessing, result: h.enhanceResult, error: null, enhance: vi.fn(), reset: vi.fn() }),
}));
import type { CompResult } from "@portage/shared";
let mockComps: CompResult | null = null;
vi.mock("@/hooks/use-comps", () => ({
  useComps: () => ({ comps: mockComps, isLoading: false, error: null, fetchComps: vi.fn() }),
}));
import type { Listing } from "@/hooks/use-listings";
let mockListings: Listing[] = [];
let mockListingsLoading = false;
let mockListingsError: string | null = null;
const refetchListingsMock = vi.fn();
vi.mock("@/hooks/use-listings", () => ({
  useListings: () => ({ listings: mockListings, isLoading: mockListingsLoading, error: mockListingsError, refetch: refetchListingsMock, createListing: vi.fn() }),
}));
vi.mock("@/components/capture/photo-gallery-strip", () => ({
  PhotoGalleryStrip: ({ onDelete, onAddPhotos, onEditPhoto }: { onDelete?: (i: number) => void; onAddPhotos?: (files: File[]) => void; onEditPhoto?: (i: number) => void }) => (
    <>
      <button onClick={() => onDelete?.(0)}>strip-delete</button>
      <button onClick={() => onAddPhotos?.([new File(["x"], "x.jpg", { type: "image/jpeg" })])}>
        strip-add
      </button>
      <button onClick={() => onEditPhoto?.(0)}>strip-edit</button>
    </>
  ),
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

// Stub the card only for the T2 contract test; the real card renders elsewhere
// (the sync-badge test reads its badge).
let stubListingCard = false;
vi.mock("@/components/listing/listing-card", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/listing/listing-card")>();
  return {
    ListingCard: (props: React.ComponentProps<typeof real.ListingCard>) =>
      stubListingCard ? <button onClick={props.onChanged}>card-changed</button> : <real.ListingCard {...props} />,
  };
});
vi.mock("@/components/listing/listing-optimizer-panel", () => ({
  ListingOptimizerPanel: ({ itemId }: { itemId: string }) => <div>optimizer:{itemId}</div>,
}));

import { ItemDetail } from "./item-detail";

const candidateFixture = {
  name: "Canon AE-1", description: "d", category: "electronics", condition: "good" as const,
  conditionNotes: "", brand: "Canon", model: "AE-1", features: [] as string[],
  estimatedValueLow: 0, estimatedValueHigh: 0, confidence: 0.9,
};

// jsdom has no scrollIntoView; the deep-link test installs one. Capture
// whatever is there so every test starts from the same prototype state.
const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
afterEach(() => {
  h.itemError = null;
  mockListings = [];
  mockListingsLoading = false;
  mockListingsError = null;
  mockComps = null;
  refetchListingsMock.mockClear();
  pushMock.mockClear();
  window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

describe("ItemDetail deep-link highlight timer", () => {
  it("clears the highlight after 2 s even when a listings refetch re-runs the effect mid-timer", async () => {
    vi.useFakeTimers();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const l1 = {
      id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: "3071", marketplaceSpecificFields: null,
      status: "active", price: 100, currency: "USD",
      createdAt: "2026-08-01", publishedAt: "2026-08-01", soldAt: null,
    } as unknown as Listing;
    mockListings = [l1];
    h.apiMock.mockResolvedValue({});
    try {
      const { rerender } = render(<ItemDetail itemId="i1" focusListingId="l1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await act(() => vi.advanceTimersByTimeAsync(50)); // double-rAF → scroll + highlight
      const highlighted = () => !!document.getElementById("listing-l1")?.querySelector(".ring-2");
      expect(highlighted()).toBe(true);

      // A refetch hands the effect a new listings array before the 2 s elapse.
      mockListings = [{ ...l1 }];
      rerender(<ItemDetail itemId="i1" focusListingId="l1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await act(() => vi.advanceTimersByTimeAsync(2100));

      expect(highlighted()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ItemDetail — header cluster", () => {
  it("carries the theme toggle and user menu", () => {
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("carries the header cluster on the not-found error page too", () => {
    h.itemError = "Item not found";
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    } finally {
      h.itemError = null;
    }
  });
});

describe("ItemDetail (prop-driven)", () => {
  it("renders the item given an itemId prop, without route params", () => {
    render(
      <ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: h.item.title })).toBeInTheDocument();
  });

  // Housekeeping-1 T2/T4: the header shows the one item price; the AI
  // estimated-value range and the Estimated Value panel are retired.
  it("shows items.price in the header and no estimated-value range or panel", () => {
    h.item.price = 149;
    h.item.estimatedValueMin = 80 as unknown as null;
    h.item.estimatedValueMax = 160 as unknown as null;
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("$149")).toBeInTheDocument();
    expect(screen.queryByText(/\$80/)).not.toBeInTheDocument();
    expect(screen.queryByText("Estimated Value")).not.toBeInTheDocument();
    h.item.price = null;
    h.item.estimatedValueMin = null;
    h.item.estimatedValueMax = null;
  });

  it("hides the back chevron in pane variant", () => {
    render(
      <ItemDetail itemId="i1" variant="pane" onDeleted={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  // F5: a listings fetch failure silently hid the whole Marketplace Listings
  // section AND the List CTA — dead end with zero feedback.
  it("surfaces a listings fetch error with a retry action", async () => {
    mockListingsError = "Failed to load listings";
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("Failed to load listings")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchListingsMock).toHaveBeenCalled();
  });

  // F5: with the listings fetch errored, the last-photo delete guard used to
  // FAIL OPEN (listingsRef stays []) — eBay would keep old photos live while
  // the app shows none. It must fail closed.
  it("blocks last-photo delete when listing status cannot be verified", async () => {
    h.item.photos = [{ url: "u1", key: "k1" }];
    mockListingsError = "Failed to load listings";
    h.updateItem.mockClear();
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "strip-delete" }));
    expect(h.updateItem).not.toHaveBeenCalled();
    expect(screen.getByText(/can.t verify listing status/i)).toBeInTheDocument();
    h.item.photos = [];
  });

  // Counterpart of the fail-closed guard: once the fetch settles clean with
  // no active listing, the last-photo delete must go through.
  it("allows last-photo delete when listings loaded with none active", async () => {
    h.item.photos = [{ url: "u1", key: "k1" }];
    h.updateItem.mockClear();
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "strip-delete" }));
    expect(h.updateItem).toHaveBeenCalledWith({ photos: [] });
    h.item.photos = [];
  });

  // F12: per-file upload failures collapsed to a bare count — systemic causes
  // (auth, rembg outage) were indistinguishable from flaky files.
  it("includes the first upstream error message in the upload failure summary", async () => {
    h.apiUploadMock.mockRejectedValue(new Error("Payload too large"));
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "strip-add" }));
    expect(await screen.findByText(/payload too large/i)).toBeInTheDocument();
  });

  // F14: the error/not-found branch rendered the back chevron unconditionally;
  // it must respect variant like the success header does.
  it("hides the back chevron in the pane variant error state", () => {
    h.itemError = "Item not found";
    render(<ItemDetail itemId="i1" variant="pane" onDeleted={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("Item not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument();
  });

  // F7: the raw delete modal ConfirmSheet was extracted FROM had no dialog
  // role, no Escape, no focus management — it must be the shared ConfirmSheet.
  it("renders the delete confirmation as a modal dialog", async () => {
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/cannot be undone/i);
  });

  // F11: a failed delete used to close the sheet via `catch {}` with zero
  // feedback — the item silently stayed.
  it("keeps the confirm sheet open and surfaces the error when delete fails", async () => {
    h.deleteItem.mockRejectedValueOnce(new Error("Delete failed upstream"));
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete failed upstream/i)).toBeInTheDocument();
  });

  it("calls onDeleted after a confirmed delete", async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={onDeleted} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(h.deleteItem).toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();
  });
});

describe("ItemDetail — price truth (Housekeeping-1 T2)", () => {
  it("refetches the item when a listing card reports a change, so items.price reflects a card price edit", async () => {
    mockListings = [{
      id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: null, marketplaceSpecificFields: null,
      status: "draft", price: 100, currency: "USD",
      createdAt: "2026-08-01", publishedAt: null, soldAt: null,
    } as unknown as Listing];
    h.apiMock.mockResolvedValue({});
    h.refetchItem.mockClear();
    stubListingCard = true;
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "card-changed" }));

    expect(refetchListingsMock).toHaveBeenCalled();
    expect(h.refetchItem).toHaveBeenCalled();
    stubListingCard = false;
  });
});

describe("ItemDetail — item status control (Housekeeping-1 T6)", () => {
  it("offers the manual statuses and PATCHes status=asset; with a live listing it is read-only and shows Active", async () => {
    h.updateItem.mockClear();
    const user = userEvent.setup();
    const { unmount } = render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    const select = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    await user.selectOptions(select, "asset");
    expect(h.updateItem).toHaveBeenCalledWith({ status: "asset" });
    unmount();

    mockListings = [{
      id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: "3001", marketplaceSpecificFields: null,
      status: "active", price: 100, currency: "USD",
      createdAt: "2026-08-01", publishedAt: "2026-08-01", soldAt: null,
    } as unknown as Listing];
    stubListingCard = true;
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    const locked = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(locked.disabled).toBe(true);
    expect(locked.value).toBe("active");
    stubListingCard = false;
  });
});

describe("ItemDetail — item status control, remaining branches (review gaps 3 + 5)", () => {
  it("locks to Draft / Sold from listings, stays disabled while listings load, and surfaces an error when the status PATCH fails", async () => {
    stubListingCard = true;
    for (const [status, expected] of [["draft", "draft"], ["sold", "sold"]] as const) {
      mockListings = [{
        id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
        marketplaceListingId: null, marketplaceSpecificFields: null,
        status, price: 100, currency: "USD",
        createdAt: "2026-08-01", publishedAt: null, soldAt: null,
      } as unknown as Listing];
      const { unmount } = render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      const locked = screen.getByLabelText("Status") as HTMLSelectElement;
      expect(locked.disabled).toBe(true);
      expect(locked.value).toBe(expected);
      unmount();
    }
    stubListingCard = false;
    mockListings = [];

    // Loading window: listings unknown → the control must not accept a PATCH.
    mockListingsLoading = true;
    const { unmount: unmountLoading } = render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    expect((screen.getByLabelText("Status") as HTMLSelectElement).disabled).toBe(true);
    unmountLoading();
    mockListingsLoading = false;

    h.updateItem.mockRejectedValueOnce(new Error("Failed to update status"));
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Status"), "sold");
    expect(await screen.findByText("Failed to update status")).toBeInTheDocument();
    expect((screen.getByLabelText("Status") as HTMLSelectElement).disabled).toBe(false);
  });
});

describe("ItemDetail — status save surfaces syncWarnings (review)", () => {
  it("shows a 200-with-syncWarnings result instead of swallowing it", async () => {
    h.updateItem.mockResolvedValueOnce({ syncWarnings: ["ebay: listing 3001 sync could not be queued — edit saved, retry from the listing page"] });
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Status"), "archived");
    expect(await screen.findByText(/could not be queued/)).toBeInTheDocument();
  });
});

describe("ItemDetail — sync badge wiring (P3)", () => {
  it("fetches /sync-log/status for the item's listings and renders the badge on the card", async () => {
    mockListings = [{
      id: "l1", itemId: "i1", userId: "u1", marketplace: "reverb",
      marketplaceListingId: "87654321", marketplaceSpecificFields: null,
      status: "active", price: 100, currency: "USD",
      createdAt: "2026-08-01", publishedAt: "2026-08-01", soldAt: null,
    } as unknown as Listing];
    h.apiMock.mockImplementation(async (path: string) => {
      if (String(path).startsWith("/sync-log/status")) {
        return { statuses: [{ listingId: "l1", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z", message: "Reverb 422: shipping required" }] };
      }
      return {};
    });

    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);

    expect(await screen.findByTestId("sync-badge-l1")).toHaveTextContent(/sync failed/i);
    expect(h.apiMock).toHaveBeenCalledWith("/sync-log/status?listingIds=l1", expect.objectContaining({ token: "t" }));
  });
});

describe("ItemDetail — rescan", () => {
  it("renders a Rescan action that is disabled when the item has no photos", () => {
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Rescan" })).toBeDisabled();
  });

  it("posts at most the first 3 photo URLs to /scan/refine and opens the diff sheet", async () => {
    h.item.photos = [1, 2, 3, 4].map((n) => ({ url: `https://img/p${n}.jpg`, key: `p${n}` }));
    h.apiMock.mockImplementation(async (path: string) =>
      path === "/scan/refine"
        ? { identification: { name: "Canon AE-1 Program" }, detailed: { candidates: [{ ...candidateFixture, name: "Canon AE-1 Program" }], reasoning: [] } }
        : {},
    );
    const user = userEvent.setup();
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Rescan" }));
      expect(h.apiMock).toHaveBeenCalledWith("/scan/refine", expect.objectContaining({
        method: "POST",
        body: { imageUrls: ["https://img/p1.jpg", "https://img/p2.jpg", "https://img/p3.jpg"] },
      }));
      const dialog = await screen.findByRole("dialog", { name: "Rescan results" });
      expect(within(dialog).getByText("Canon AE-1 Program")).toBeInTheDocument();
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
    }
  });

  it("Apply PATCHes only the checked fields plus scan provenance, then closes the sheet", async () => {
    h.item.photos = [{ url: "https://img/p1.jpg", key: "p1" }];
    const provenance = { identification: { provider: "gemini", model: "gemini-3.8-flash" } };
    h.apiMock.mockResolvedValue({
      identification: {},
      detailed: { candidates: [{ ...candidateFixture, name: "Canon AE-1 Program", model: "AE-1P" }], reasoning: [], provenance },
    });
    h.updateItem.mockClear();
    const user = userEvent.setup();
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Rescan" }));
      const dialog = await screen.findByRole("dialog", { name: "Rescan results" });
      await user.click(within(dialog).getByRole("checkbox", { name: "Title" }));
      await user.click(within(dialog).getByRole("button", { name: "Apply 1 change" }));
      expect(h.updateItem).toHaveBeenCalledWith({
        title: "Canon AE-1 Program",
        marketplaceData: { scan: { visionCategory: "electronics", provenance } },
      });
      expect(screen.queryByRole("dialog", { name: "Rescan results" })).not.toBeInTheDocument();
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
    }
  });

  it("shows the refine error inline (e.g. the monthly scan limit) instead of opening a sheet", async () => {
    h.item.photos = [{ url: "https://img/p1.jpg", key: "p1" }];
    h.apiMock.mockRejectedValue(new Error("Monthly AI scan limit reached (10). Upgrade to Pro for unlimited scans."));
    const user = userEvent.setup();
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Rescan" }));
      expect(await screen.findByText(/monthly ai scan limit reached/i)).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
    }
  });

  it("translates the storage-origin 400 into plain English instead of the raw server text", async () => {
    h.item.photos = [{ url: "https://picsum.photos/200", key: "p1" }];
    h.apiMock.mockRejectedValue(new Error("Image URLs must reference the application storage origin"));
    const user = userEvent.setup();
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Rescan" }));
      expect(await screen.findByText("Rescan can't read these photos yet — they aren't hosted by Portage or eBay.")).toBeInTheDocument();
      expect(screen.queryByText(/application storage origin/)).not.toBeInTheDocument();
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
    }
  });

  it("disables Rescan and shows a busy label while the refine call is in flight", async () => {
    h.item.photos = [{ url: "https://img/p1.jpg", key: "p1" }];
    h.apiMock.mockReturnValue(new Promise(() => {}));
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Rescan" }));
      fireEvent.click(screen.getByRole("button", { name: "Rescanning…" }));
      expect(screen.getByRole("button", { name: "Rescanning…" })).toBeDisabled();
      // Count only the refine call — the header's unread-count hook also goes through api().
      expect(h.apiMock.mock.calls.filter(([path]) => path === "/scan/refine")).toHaveLength(1);
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
    }
  });

  it("keeps the sheet open and shows the error when the Apply PATCH fails", async () => {
    h.item.photos = [{ url: "https://img/p1.jpg", key: "p1" }];
    h.apiMock.mockResolvedValue({
      identification: {},
      detailed: { candidates: [{ ...candidateFixture, name: "Canon AE-1 Program" }], reasoning: [] },
    });
    h.updateItem.mockRejectedValueOnce(new Error("eBay rejected the revise"));
    const user = userEvent.setup();
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Rescan" }));
      const dialog = await screen.findByRole("dialog", { name: "Rescan results" });
      await user.click(within(dialog).getByRole("checkbox", { name: "Title" }));
      await user.click(within(dialog).getByRole("button", { name: "Apply 1 change" }));
      expect(screen.getByRole("dialog", { name: "Rescan results" })).toBeInTheDocument();
      expect(within(dialog).getByText("eBay rejected the revise")).toBeInTheDocument();
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
      h.updateItem.mockResolvedValue({});
    }
  });

  it("surfaces syncWarnings from a 200 Apply after closing the sheet", async () => {
    h.item.photos = [{ url: "https://img/p1.jpg", key: "p1" }];
    h.apiMock.mockResolvedValue({
      identification: {},
      detailed: { candidates: [{ ...candidateFixture, name: "Canon AE-1 Program" }], reasoning: [] },
    });
    h.updateItem.mockResolvedValueOnce({ syncWarnings: ["Reverb sync queued"] });
    const user = userEvent.setup();
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Rescan" }));
      const dialog = await screen.findByRole("dialog", { name: "Rescan results" });
      await user.click(within(dialog).getByRole("checkbox", { name: "Title" }));
      await user.click(within(dialog).getByRole("button", { name: "Apply 1 change" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Reverb sync queued")).toBeInTheDocument();
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
      h.updateItem.mockResolvedValue({});
    }
  });

  it("a double-tap on Apply while the PATCH is in flight fires one PATCH", async () => {
    h.item.photos = [{ url: "https://img/p1.jpg", key: "p1" }];
    h.apiMock.mockResolvedValue({
      identification: {},
      detailed: { candidates: [{ ...candidateFixture, name: "Canon AE-1 Program" }], reasoning: [] },
    });
    h.updateItem.mockClear();
    h.updateItem.mockReturnValue(new Promise(() => {}));
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Rescan" }));
      const dialog = await screen.findByRole("dialog", { name: "Rescan results" });
      fireEvent.click(within(dialog).getByRole("checkbox", { name: "Title" }));
      const apply = within(dialog).getByRole("button", { name: "Apply 1 change" });
      fireEvent.click(apply);
      fireEvent.click(apply);
      expect(h.updateItem).toHaveBeenCalledTimes(1);
      expect(within(dialog).getByRole("button", { name: "Applying…" })).toBeDisabled();
    } finally {
      h.item.photos = [];
      h.apiMock.mockReset();
      h.updateItem.mockResolvedValue({});
    }
  });
});

describe("ItemDetail — photo save serialization (Reverb-published race)", () => {
  it("a second accept while the save PATCH is in flight must not fire a second PATCH", async () => {
    h.item.photos = [{ url: "https://img/k0.jpg", key: "K0", isPrimary: true }];
    h.enhanceResult = { image: { key: "K1", url: "https://img/k1.jpg", width: 100, height: 100, size: 1000 } };
    // Reverb-published items make PATCH /items slow — never resolve here.
    h.updateItem.mockClear();
    h.updateItem.mockReturnValue(new Promise(() => {}));
    try {
      render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
      fireEvent.click(screen.getByText("strip-edit"));
      const accept = screen.getByRole("button", { name: /use this photo/i });
      fireEvent.click(accept);
      fireEvent.click(accept); // impatient double-tap during the slow Reverb sync
      expect(h.updateItem).toHaveBeenCalledTimes(1);
    } finally {
      h.enhanceResult = null;
      h.updateItem.mockResolvedValue({});
      h.item.photos = [];
    }
  });
});

describe("ItemDetail — light-mode tag contrast (operator: tags unreadable in light mode, 2026-09-06)", () => {
  it("renders the partial-comps notice on the legible amber-700 shade", async () => {
    mockComps = {
      sold: [], active: [],
      stats: { soldMedian: null, soldAvg: null, activeMedian: null, activeAvg: null, sampleSize: 0 },
      partial: true,
    };
    render(<ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByText("Some eBay results could not be loaded")).toHaveClass("text-amber-700");
  });
});
