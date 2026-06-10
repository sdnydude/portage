import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScanFlow } from "./scan-flow";

// ─── Heavy children / browser-API hooks mocked; wiring under test is real ───

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("./camera-capture", () => ({
  CameraCapture: () => null,
}));

vi.mock("./image-picker", () => ({
  ImagePicker: ({
    onSelect,
    children,
  }: {
    onSelect: (files: File[]) => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => onSelect([new File(["x"], "x.jpg", { type: "image/jpeg" })])}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/hooks/use-enhance", () => ({
  useEnhance: () => ({
    isProcessing: false,
    result: null,
    error: null,
    enhance: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-bg-removal", () => ({
  useBgRemoval: () => ({
    isProcessing: false,
    resultUrl: null,
    error: null,
    removeBackground: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/components/listing-flow/crop-tool", () => ({
  CropTool: () => null,
}));

vi.mock("@/components/image/before-after-slider", () => ({
  BeforeAfterSlider: () => null,
}));

// Controllable stand-in for the unit-tested aspects hook.
const scanAspectsState = {
  resolvedCategoryId: "33034" as string | null,
  resolvedCategoryName: "Electric Guitars" as string | null,
  conditionIds: [] as string[],
  isCategoryResolving: false,
  isAspectsLoading: false,
  aspects: {} as Record<string, { required: boolean; values: string[] | null }>,
  aspectValues: {} as Record<string, string>,
  setAspectValue: vi.fn(),
  suggestions: {} as Record<string, string[]>,
  confirmSuggestion: vi.fn(),
  missingRequired: [] as string[],
  buildAspects: vi.fn(() => ({}) as Record<string, string[]>),
  aspectsBlockPublish: false,
  resolveCategory: vi.fn(),
};

vi.mock("@/hooks/use-scan-aspects", () => ({
  useScanAspects: () => scanAspectsState,
}));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  API_BASE: "http://test-api",
  api: (...args: unknown[]) => apiMock(...args),
}));

const CANDIDATE = {
  name: "Fender Stratocaster",
  description: "Electric guitar",
  category: "Guitars",
  condition: "good",
  conditionNotes: "",
  estimatedValueLow: 400,
  estimatedValueHigh: 600,
  brand: "Fender",
  model: "Stratocaster",
  features: [],
  confidence: 0.9,
};

async function renderInReview() {
  // Photo upload goes through raw fetch, not the api() wrapper.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } }),
  }) as unknown as typeof fetch;

  apiMock.mockImplementation(async (path: string) => {
    if (path === "/scan/refine") {
      return { identification: CANDIDATE, detailed: { candidates: [CANDIDATE], reasoning: [] } };
    }
    if (path.startsWith("/items/comps/search")) throw new Error("no comps");
    if (path === "/seller-profile") return { profile: { ebayPublishMode: "live" } };
    if (path === "/items") return { id: "item-1" };
    return {};
  });

  render(<ScanFlow onClose={vi.fn()} />);
  fireEvent.click(screen.getByText("Choose from Gallery"));
  fireEvent.click(await screen.findByText(/Scan 1 Photo with Porter/));
  await screen.findByText("Review");
}

describe("ScanFlow review wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanAspectsState.aspects = {};
    scanAspectsState.missingRequired = [];
    scanAspectsState.aspectsBlockPublish = false;
    scanAspectsState.conditionIds = [];
    scanAspectsState.resolvedCategoryId = "33034";
    scanAspectsState.resolvedCategoryName = "Electric Guitars";
    scanAspectsState.buildAspects = vi.fn(() => ({}) as Record<string, string[]>);
  });

  it("renders comp percentile bands with a demand badge; picking a band sets the sale price", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } }),
    }) as unknown as typeof fetch;

    apiMock.mockImplementation(async (path: string) => {
      if (path === "/scan/refine") {
        return { identification: CANDIDATE, detailed: { candidates: [CANDIDATE], reasoning: [] } };
      }
      if (path.startsWith("/items/comps/search")) {
        return {
          sold: [{ title: "Comp", price: 195, currency: "USD", condition: "GOOD", imageUrl: null, listingUrl: "https://ebay.com/itm/1", soldDate: null }],
          active: [],
          stats: {
            soldMedian: 195, soldAvg: 195, activeMedian: null, activeAvg: null,
            sampleSize: 12, p25: 165, p50: 195, p75: 225, sellThrough: 0.8,
          },
        };
      }
      if (path === "/seller-profile") return { profile: { ebayPublishMode: "live" } };
      if (path === "/items") return { id: "item-1" };
      return {};
    });

    render(<ScanFlow onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Choose from Gallery"));
    fireEvent.click(await screen.findByText(/Scan 1 Photo with Porter/));
    await screen.findByText("Review");

    fireEvent.click(await screen.findByRole("button", { name: /move it/i }));
    expect(screen.getByText(/hot demand/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("165")).toBeInTheDocument();
  });

  it("review shows the gallery strip (no inline editor); tapping a thumb opens the editor overlay", async () => {
    await renderInReview();

    // Gallery card replaces the always-on editor.
    expect(screen.getByText(/photos · 1/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close editor/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close editor/i }));
    expect(screen.queryByRole("button", { name: /rotate/i })).not.toBeInTheDocument();
  });

  it("editor overlay is the full PhotoEditPanel: title + all 4 tools", async () => {
    await renderInReview();
    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));

    expect(screen.getByText(/edit photo 1 of 1/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bg remove/i })).toBeInTheDocument();
  });

  it("renders the eBay item specifics section in the review panel", async () => {
    scanAspectsState.aspects = { Brand: { required: true, values: null } };
    scanAspectsState.missingRequired = ["Brand"];
    scanAspectsState.aspectsBlockPublish = true;

    await renderInReview();

    expect(screen.getByText("eBay item specifics")).toBeInTheDocument();
    expect(screen.getByText("1 required")).toBeInTheDocument();
  });

  it("disables Save & List with a reason while required aspects are missing; Save stays enabled", async () => {
    scanAspectsState.aspects = { Brand: { required: true, values: null } };
    scanAspectsState.missingRequired = ["Brand"];
    scanAspectsState.aspectsBlockPublish = true;

    await renderInReview();

    expect(screen.getByRole("button", { name: "Save & List" })).toBeDisabled();
    expect(screen.getByText("Complete 1 required eBay detail first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("Save & List posts the seller-profile-aware payload with aspects and categoryId", async () => {
    scanAspectsState.buildAspects = vi.fn(() => ({ Brand: ["Fender"] }));

    await renderInReview();
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    // Profile says live → publishMode live with aspects + categoryId attached.
    const listingsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/listings");
      expect(call).toBeDefined();
      return call;
    });
    expect(listingsCall?.[1]).toMatchObject({
      method: "POST",
      body: {
        itemId: "item-1",
        marketplace: "ebay",
        price: 500,
        publishMode: "live",
        marketplaceSpecificFields: {
          aspects: { Brand: ["Fender"] },
          categoryId: "33034",
        },
      },
    });
    // The legacy flag must be gone — publishMode drives behavior now.
    expect(listingsCall?.[1].body).not.toHaveProperty("publishImmediately");
  });

  it("falls back to draft publishMode when the seller-profile fetch rejects — never an accidental live publish", async () => {
    scanAspectsState.buildAspects = vi.fn(() => ({ Brand: ["Fender"] }));

    await renderInReview();

    // Profile endpoint starts failing AFTER review renders — Save & List must
    // degrade to draft via the .catch(() => null) glue, not throw or go live.
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/seller-profile") throw new Error("profile service down");
      if (path === "/items") return { id: "item-1" };
      return {};
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    const listingsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/listings");
      expect(call).toBeDefined();
      return call;
    });
    expect(listingsCall?.[1]).toMatchObject({
      method: "POST",
      body: {
        itemId: "item-1",
        marketplace: "ebay",
        publishMode: "draft",
        // Confirmed specifics survive the draft fallback — the draft row
        // persists them for the later publish step.
        marketplaceSpecificFields: {
          aspects: { Brand: ["Fender"] },
          categoryId: "33034",
        },
      },
    });
  });

  it("constrains condition pills to the category's conditionIds and snaps a disallowed selection", async () => {
    // Category only accepts conditionId 1000 → Portage "new" only. The AI
    // candidate said "good", so the selection must snap to New.
    scanAspectsState.conditionIds = ["1000"];

    await renderInReview();

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Good" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" }).className).toContain("bg-[var(--teal)]");
  });

  it("shows the resolved eBay category under the Category field with a re-resolve action", async () => {
    await renderInReview();

    expect(screen.getByText(/eBay category: Electric Guitars/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "change" }));
    // Re-resolve uses the seller's edited category text (candidate.category here).
    expect(scanAspectsState.resolveCategory).toHaveBeenCalledWith("Guitars");
  });

  it("warns instead of rendering an empty pill row when no conditionIds are recognized", async () => {
    // getAvailablePortageConditions returns [] for unrecognized-only IDs —
    // its contract says the UI must warn upstream.
    scanAspectsState.conditionIds = ["9999"];

    await renderInReview();

    expect(screen.getByText(/condition.*captured at listing time/i)).toBeInTheDocument();
    // The AI-suggested condition must not be silently snapped away.
    expect(screen.queryByRole("button", { name: "Good" })).not.toBeInTheDocument();

    // ...and Save persists that untouched condition — proof the warn path
    // doesn't corrupt the item record.
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const itemsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/items");
      expect(call).toBeDefined();
      return call;
    });
    expect(itemsCall?.[1].body).toMatchObject({ condition: "good" });
  });
});
