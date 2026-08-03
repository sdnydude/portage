import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// jsdom has no scrollIntoView; the chat thread auto-scrolls on render.
Element.prototype.scrollIntoView = vi.fn();
// jsdom lacks ResizeObserver; CropTool observes its stage element.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const h = vi.hoisted(() => ({
  updatePhoto: vi.fn(),
  ensureItemCreated: vi.fn(),
  prepare: vi.fn(),
  prepError: null as string | null,
  prepDataNull: false,
  prepEbay: null as Record<string, unknown> | null,
  cardProps: {} as Record<string, unknown>,
  lastStep: "confirmed",
}));

const flowState = {
  photos: [{ url: "https://example.com/1.jpg", key: "k1" }],
  primaryPhotoIndex: 0,
  recognition: { status: "complete", candidates: [{ name: "Canon AE-1", confidence: 0.9 }], selectedIndex: 0, reasoning: [] },
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
    lastStep: h.lastStep,
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
    ensureItemCreated: h.ensureItemCreated,
    publish: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-prepare-listing", () => ({
  usePrepareListing: () => ({
    data: h.prepDataNull ? null : {
      title: "Canon AE-1",
      description: "d",
      condition: "good",
      conditionDescription: "",
      brand: "Canon",
      model: "AE-1",
      pricing: { suggested: 100, low: 80, high: 120, currency: "USD", confidence: "high", basedOn: 3, conditionMatch: "exact" },
      comps: { ebay: null, reverb: null },
      ebay: h.prepEbay,
      reverb: null,
      isMusicGear: false,
      aiConfidence: 0.9,
      warnings: [],
    },
    isLoading: false,
    error: h.prepError,
    prepare: h.prepare,
    reset: vi.fn(),
  }),
}));
vi.mock("../listing/listing-preview-card", () => ({
  ListingPreviewCard: (props: Record<string, unknown>) => {
    h.cardProps = props;
    return <div data-testid="preview-card" />;
  },
}));
vi.mock("./fee-estimate", () => ({ FeeEstimate: () => null }));
vi.mock("./publish-success", () => ({ PublishSuccess: () => null }));
vi.mock("./photo-capture-overlay", () => ({ PhotoCaptureOverlay: () => null }));
vi.mock("../listing/weight-dims-inputs", () => ({ WeightDimsInputs: () => null }));
vi.mock("../listing/aspect-fill-sheet", () => ({ AspectFillSheet: () => null }));
vi.mock("../listing/weight-fill-sheet", () => ({ WeightFillSheet: () => null }));

import { ConversationalFlow } from "./conversational-flow";

describe("ConversationalFlow — AI-prepared Best Offer floor is visible (BO-5)", () => {
  it("renders the prepared auto-accept floor so it never publishes unseen", () => {
    h.prepEbay = { bestOfferAutoAcceptPrice: 85, weight: { value: 16, unit: "OUNCE" }, dimensions: { length: 8, width: 6, height: 4 }, packageType: null, categoryId: "175669" };
    try {
      render(<ConversationalFlow />);
      expect(screen.getByText(/\$85/)).toBeInTheDocument();
      expect(screen.getByText(/auto-accept/i)).toBeInTheDocument();
    } finally {
      h.prepEbay = null;
    }
  });
});

describe("ConversationalFlow — photo editing wiring (S2.5-8)", () => {
  it("passes the flow's updatePhoto to ListingPreviewCard so editor tools persist into flow state", () => {
    render(<ConversationalFlow />);
    expect(screen.getByTestId("preview-card")).toBeInTheDocument();
    expect(h.cardProps.onPhotoUpdated).toBe(h.updatePhoto);
  });

  it("review card shows the gallery strip; tapping a thumb opens the editor overlay", () => {
    h.lastStep = "review";
    try {
      render(<ConversationalFlow />);
      expect(screen.getByText(/tap to edit/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
      expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
    } finally {
      h.lastStep = "confirmed";
    }
  });

  it("still-uploading blob photos render in the strip without an edit affordance", () => {
    h.lastStep = "review";
    const original = flowState.photos;
    flowState.photos = [
      { url: "blob:local-1", key: "local-1" },
      { url: "https://example.com/2.jpg", key: "k2" },
    ];
    try {
      render(<ConversationalFlow />);
      expect(screen.queryByRole("button", { name: /edit photo 1/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit photo 2/i })).toBeInTheDocument();
    } finally {
      flowState.photos = original;
      h.lastStep = "confirmed";
    }
  });

  it("tapping Crop in the editor opens the crop overlay", () => {
    h.lastStep = "review";
    try {
      render(<ConversationalFlow />);
      fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
      fireEvent.click(screen.getByRole("button", { name: /^crop$/i }));
      // CropTool overlay: aspect-ratio presets are its signature controls.
      // New pan/zoom crop tool: aspect chips are gone (fixed 1:1 window).
      expect(screen.getByText(/drag to position/i)).toBeInTheDocument();
    } finally {
      h.lastStep = "confirmed";
    }
  });
});

describe("ConversationalFlow — fresh-scan prepare (item created at confirm)", () => {
  it("Looks right creates the item via ensureItemCreated and runs prepare with its id", async () => {
    h.lastStep = "recognition";
    h.ensureItemCreated.mockResolvedValue("item-5");
    h.prepare.mockClear();
    try {
      render(<ConversationalFlow />);
      fireEvent.click(screen.getByRole("button", { name: /looks right/i }));
      expect(h.ensureItemCreated).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => {
        expect(h.prepare).toHaveBeenCalledWith("item-5", ["ebay"]);
      });
    } finally {
      h.lastStep = "confirmed";
    }
  });
});

describe("ConversationalFlow — prepare failure surface", () => {
  it("renders the prepare error with a Retry pill that re-runs prepare", async () => {
    h.prepError = "Preparing the listing failed";
    h.prepDataNull = true;
    h.ensureItemCreated.mockResolvedValue("item-5");
    h.prepare.mockClear();
    try {
      render(<ConversationalFlow />);
      expect(screen.getByText(/couldn.t prepare|preparing the listing failed/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      await vi.waitFor(() => expect(h.prepare).toHaveBeenCalledTimes(1));
    } finally {
      h.prepError = null;
      h.prepDataNull = false;
    }
  });
});
