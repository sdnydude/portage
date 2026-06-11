import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// jsdom has no scrollIntoView; ChatMode auto-scrolls on render.
Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({
  updatePhoto: vi.fn(),
  cardProps: {} as Record<string, unknown>,
  compactMode: false,
}));

const flowState = {
  photos: [{ url: "https://example.com/1.jpg", key: "k1" }],
  primaryPhotoIndex: 0,
  recognition: { status: "complete", candidates: [{ name: "Canon AE-1", confidence: 0.9 }], selectedIndex: 0 },
  title: "Canon AE-1",
  description: "",
  category: "electronics",
  condition: "good",
  brand: "Canon",
  model: "AE-1",
  features: [],
  quantity: 1,
  price: 100,
  marketplace: "ebay",
  shippingMethod: "",
  pricingStrategy: null,
  publishStatus: "idle",
  listingId: null,
  weight: null,
  dimLength: null,
  dimWidth: null,
  dimHeight: null,
  ebayPackageType: null,
  comps: null,
};

vi.mock("@/hooks/use-listing-flow", () => ({
  useListingFlow: () => ({
    state: flowState,
    lastStep: "confirmed",
    error: null,
    clearError: vi.fn(),
    saveWarning: false,
    setField: vi.fn(),
    startFromPhoto: vi.fn(),
    startFromItem: vi.fn(),
    confirmRecognition: vi.fn(),
    fetchComps: vi.fn(),
    applyPricingStrategy: vi.fn(),
    updateWeightDims: vi.fn(),
    applyEstimatedWeightDims: vi.fn(),
    addPhotos: vi.fn(),
    updatePhoto: h.updatePhoto,
    publish: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-prepare-listing", () => ({
  usePrepareListing: () => ({
    data: {
      title: "Canon AE-1",
      description: "d",
      condition: "good",
      conditionDescription: "",
      brand: "Canon",
      model: "AE-1",
      pricing: { suggested: 100, low: 80, high: 120, currency: "USD", confidence: "high", basedOn: 3, conditionMatch: "exact" },
      comps: { ebay: null, reverb: null },
      ebay: null,
      reverb: null,
      isMusicGear: false,
      aiConfidence: 0.9,
      warnings: [],
    },
    isLoading: false,
    error: null,
    prepare: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-user-preferences", () => ({
  useUserPreferences: () => ({ compactMode: h.compactMode, updatePrefs: vi.fn() }),
}));
vi.mock("../listing/listing-preview-card", () => ({
  ListingPreviewCard: (props: Record<string, unknown>) => {
    h.cardProps = props;
    return <div data-testid="preview-card" />;
  },
}));
vi.mock("./fee-estimate", () => ({ FeeEstimate: () => null }));
vi.mock("./publish-success", () => ({ PublishSuccess: () => null }));
vi.mock("../listing/aspect-fill-sheet", () => ({ AspectFillSheet: () => null }));
vi.mock("../listing/weight-fill-sheet", () => ({ WeightFillSheet: () => null }));
vi.mock("./shipping-config-card", () => ({ ShippingConfigCard: () => null }));
vi.mock("./pricing-strategy-picker", () => ({ PricingStrategyPicker: () => null }));
vi.mock("./photo-capture-overlay", () => ({ PhotoCaptureOverlay: () => null }));

import { HybridFlow } from "./hybrid-flow";

describe("HybridFlow — photo editing wiring (S2.5-8)", () => {
  it("passes the flow's updatePhoto to ListingPreviewCard so editor tools persist into flow state", () => {
    render(<HybridFlow />);
    expect(screen.getByTestId("preview-card")).toBeInTheDocument();
    expect(h.cardProps.onPhotoUpdated).toBe(h.updatePhoto);
  });

  it("collapses the editable Item Details card while the review card is visible (no duplicate fields)", () => {
    render(<HybridFlow />);
    // review/preview is on screen…
    expect(screen.getByTestId("preview-card")).toBeInTheDocument();
    // …so the editable Item Details inputs are collapsed away
    expect(screen.queryByPlaceholderText("Item title")).not.toBeInTheDocument();
    // and can be expanded back on demand
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    expect(screen.getByPlaceholderText("Item title")).toBeInTheDocument();
  });

  it("compact mode replaces the dumb photo thumbs with the gallery strip; tapping a thumb opens the editor", () => {
    h.compactMode = true;
    try {
      render(<HybridFlow />);
      expect(screen.getByText(/tap to edit/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
      expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
    } finally {
      h.compactMode = false;
    }
  });
});
