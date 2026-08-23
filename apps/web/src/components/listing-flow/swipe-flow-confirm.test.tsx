import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// P3 c3b3013c — swipe's recognition confirm must create the item first so
// prepare() (AI fields, comps, Best Offer floor) runs on a fresh scan, the
// same photo-first contract hybrid-flow already honors.

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const h = vi.hoisted(() => ({
  ensureItemCreated: vi.fn(),
  prepare: vi.fn(),
  fetchComps: vi.fn(),
  inventoryItemId: null as string | null,
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));
vi.mock("@/hooks/use-listing-flow", () => ({
  useListingFlow: () => ({
    state: {
      photos: [{ url: "https://example.com/1.jpg", key: "k1" }],
      primaryPhotoIndex: 0,
      recognition: { status: "complete", candidates: [{ name: "Canon AE-1", confidence: 0.9 }], selectedIndex: 0, reasoning: [], confidence: 0.9 },
      inventoryItemId: h.inventoryItemId,
      title: "Canon AE-1", description: "", category: "electronics", condition: "good", brand: "Canon", model: "AE-1",
      features: [], quantity: 1, price: 100, marketplace: "ebay", shippingMethod: "flat", shippingCost: 4,
      pricingStrategy: null, publishStatus: "idle", listingId: null,
      weight: null, dimLength: null, dimWidth: null, dimHeight: null, ebayPackageType: null, comps: null,
    },
    lastStep: "confirmed", error: null, clearError: vi.fn(), saveWarning: false,
    setField: vi.fn(), startFromPhoto: vi.fn(), startFromItem: vi.fn(), confirmRecognition: vi.fn(),
    fetchComps: h.fetchComps, applyPricingStrategy: vi.fn(), updateWeightDims: vi.fn(), applyEstimatedWeightDims: vi.fn(),
    addPhotos: vi.fn(), updatePhoto: vi.fn(), ensureItemCreated: h.ensureItemCreated, publish: vi.fn(), reset: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-prepare-listing", () => ({
  usePrepareListing: () => ({ data: null, isLoading: false, error: null, prepare: h.prepare, reset: vi.fn() }),
}));
vi.mock("@/hooks/use-photo-edit", () => ({
  usePhotoEdit: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));
vi.mock("./photo-capture-overlay", () => ({ PhotoCaptureOverlay: () => null }));
vi.mock("../capture/photo-edit-overlay", () => ({ PhotoEditOverlay: () => null }));
vi.mock("../capture/photo-gallery-strip", () => ({ PhotoGalleryStrip: () => null }));
vi.mock("./fee-estimate", () => ({ FeeEstimate: () => null }));
vi.mock("./publish-success", () => ({ PublishSuccess: () => null }));
vi.mock("../listing/aspect-fill-sheet", () => ({ AspectFillSheet: () => null }));
vi.mock("../listing/weight-fill-sheet", () => ({ WeightFillSheet: () => null }));

import { SwipeFlow } from "./swipe-flow";

beforeEach(() => {
  h.ensureItemCreated.mockReset();
  h.prepare.mockReset();
  h.fetchComps.mockReset();
  h.inventoryItemId = null;
});

describe("SwipeFlow — recognition confirm is photo-first (P3 c3b3013c)", () => {
  it("fresh scan: creates the item, then prepares with the new id and fetches comps", async () => {
    h.ensureItemCreated.mockResolvedValue("item-new");
    render(<SwipeFlow />);

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(h.prepare).toHaveBeenCalledWith("item-new", ["ebay"]));
    expect(h.ensureItemCreated).toHaveBeenCalledTimes(1);
    expect(h.fetchComps).toHaveBeenCalledTimes(1);
  });

  it("item create failure is shown in Configure and prepare never runs — no silent draft", async () => {
    h.ensureItemCreated.mockRejectedValue(new Error("Item save failed: 500"));
    render(<SwipeFlow />);

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Item save failed: 500/);
    expect(h.prepare).not.toHaveBeenCalled();
    // Forward is blocked until the item exists; Retry re-runs create → prepare.
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    h.ensureItemCreated.mockResolvedValue("item-retry");
    fireEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    await waitFor(() => expect(h.prepare).toHaveBeenCalledWith("item-retry", ["ebay"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
