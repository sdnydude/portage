import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  apiMock: vi.fn(),
  apiUploadMock: vi.fn(),
  enhanceResult: null as null | { image: { key: string; url: string; width: number; height: number; size: number } },
  enhanceProcessing: false,
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));
vi.mock("@/hooks/use-item", () => ({
  useItem: () => ({
    item: h.itemError ? null : h.item,
    isLoading: false, error: h.itemError, deleteItem: h.deleteItem, updateItem: h.updateItem,
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
vi.mock("@/components/capture/photo-gallery-strip", () => ({
  PhotoGalleryStrip: ({ onDelete, onAddPhotos }: { onDelete?: (i: number) => void; onAddPhotos?: (files: File[]) => void }) => (
    <>
      <button onClick={() => onDelete?.(0)}>strip-delete</button>
      <button onClick={() => onAddPhotos?.([new File(["x"], "x.jpg", { type: "image/jpeg" })])}>
        strip-add
      </button>
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

vi.mock("@/components/listing/listing-optimizer-panel", () => ({
  ListingOptimizerPanel: ({ itemId }: { itemId: string }) => <div>optimizer:{itemId}</div>,
}));

import { ItemDetail } from "./item-detail";

// jsdom has no scrollIntoView; the deep-link test installs one. Capture
// whatever is there so every test starts from the same prototype state.
const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
afterEach(() => {
  h.itemError = null;
  mockListings = [];
  mockListingsLoading = false;
  mockListingsError = null;
  refetchListingsMock.mockClear();
  pushMock.mockClear();
  window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

describe("ItemDetail (prop-driven)", () => {
  it("renders the item given an itemId prop, without route params", () => {
    render(
      <ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: h.item.title })).toBeInTheDocument();
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
