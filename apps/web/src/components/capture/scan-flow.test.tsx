import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { ScanFlow } from "./scan-flow";

// ─── Heavy children / browser-API hooks mocked; wiring under test is real ───

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

const camHolder = vi.hoisted(() => ({ props: null as null | { onCapture: (f: File) => void; onClose: () => void } }));
vi.mock("./camera-capture", () => ({
  CameraCapture: (props: { onCapture: (f: File) => void; onClose: () => void }) => {
    camHolder.props = props;
    return <div data-testid="camera-open" />;
  },
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
const apiUploadMock = vi.fn();
vi.mock("@/lib/api", () => ({
  API_BASE: "http://test-api",
  api: (...args: unknown[]) => apiMock(...args),
  apiUpload: (...args: unknown[]) => apiUploadMock(...args),
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

async function renderInReview(opts?: { onClose?: () => void; listingsResponse?: unknown }) {
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
    if (path === "/listings" && opts?.listingsResponse) return opts.listingsResponse;
    return {};
  });

  render(<ScanFlow onClose={opts?.onClose ?? vi.fn()} />);
  fireEvent.click(screen.getByText("Choose from Gallery"));
  fireEvent.click(await screen.findByText(/Scan 1 Photo with Porter/));
  await screen.findByText("Review");
}

describe("ScanFlow review wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Photo uploads go through apiUpload (401-aware multipart wrapper).
    apiUploadMock.mockResolvedValue({
      image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 },
    });
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

  it("capture-stage photo strip nests no <button> inside <button> (hydration error a579ff81)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } }),
    }) as unknown as typeof fetch;
    apiMock.mockImplementation(async () => ({}));

    const { container } = render(<ScanFlow onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Choose from Gallery"));
    await screen.findByText(/Scan 1 Photo with Porter/);

    // The remove-photo control must not be a real <button> inside the thumb
    // <button> — React 19 hydration rejects nested interactive elements.
    expect(container.querySelectorAll("button button")).toHaveLength(0);
    expect(screen.getByLabelText("Remove photo 1")).toBeInTheDocument();
  });

  it("capture stage advertises the 24-photo cap (MAX_PHOTOS_PER_ITEM)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } }),
    }) as unknown as typeof fetch;
    apiMock.mockImplementation(async () => ({}));
    render(<ScanFlow onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Choose from Gallery"));
    await screen.findByText(/Scan 1 Photo with Porter/);
    expect(screen.getByText("1/24")).toBeInTheDocument();
  });

  it("capture stage still offers gallery add after the first photo (beta report 6337abaf)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } }),
    }) as unknown as typeof fetch;
    apiMock.mockImplementation(async () => ({}));
    render(<ScanFlow onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Choose from Gallery"));
    await screen.findByText(/Scan 1 Photo with Porter/);
    // Both add paths present: camera re-shot AND gallery pick.
    expect(screen.getByLabelText("Take another photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Add from gallery")).toBeInTheDocument();
  });

  it("capture-stage strip supports long-press drag reorder before the AI scan", async () => {
    apiUploadMock
      .mockResolvedValueOnce({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } })
      .mockResolvedValueOnce({ image: { url: "http://img/2.jpg", key: "k2", width: 100, height: 100 } });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } }),
    }) as unknown as typeof fetch;
    apiMock.mockImplementation(async () => ({}));

    render(<ScanFlow onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Choose from Gallery"));
    await screen.findByText(/Scan 1 Photo with Porter/);
    fireEvent.click(screen.getByLabelText("Take another photo"));
    await act(async () => {
      camHolder.props!.onCapture(new File(["y"], "y.jpg", { type: "image/jpeg" }));
    });
    act(() => camHolder.props!.onClose());
    await screen.findByText(/Scan 2 Photos with Porter/);

    // Strip thumbs are the buttons hosting the Remove-✕ controls (the big
    // selected-photo preview shares the same alt pattern — don't match it).
    const thumbs = () =>
      screen
        .getAllByLabelText(/^Remove photo \d$/)
        .map((x) => x.closest("button")!.querySelector("img") as HTMLImageElement);
    expect(thumbs()[0].src).toContain("img/1.jpg");

    vi.useFakeTimers();
    try {
      const tile1 = thumbs()[0].closest("button")!;
      fireEvent.pointerDown(tile1, { clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));
      document.elementFromPoint = vi.fn().mockReturnValue(thumbs()[1].closest("button")!);
      fireEvent.pointerMove(tile1, { clientX: 100, clientY: 10 });
      fireEvent.pointerUp(tile1);
    } finally {
      vi.useRealTimers();
    }
    expect(thumbs()[0].src).toContain("img/2.jpg");
  });

  it("review strip supports reorder + delete via the manage sheet", async () => {
    await renderInReview();
    expect(screen.getByText(/photos · 1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /manage photos/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete photo 1/i }));
    // Deleting the only photo empties the gallery — the review strip (and the
    // sheet inside it) unmounts entirely.
    expect(screen.queryByText(/photos · 1/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^done$/i })).not.toBeInTheDocument();
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

  it("Exposure tool opens from the editor and Apply posts /images/exposure with the chosen EV", async () => {
    await renderInReview();
    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));

    apiMock.mockImplementation(async (path: string) => {
      if (path === "/images/exposure") {
        return { image: { key: "k1-ev", url: "http://img/1-ev.jpg", width: 100, height: 100 } };
      }
      return {};
    });

    fireEvent.click(screen.getByRole("button", { name: /exposure/i }));
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/images/exposure", expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ ev: 1 }),
      })),
    );
  });

  it("a failed rotate surfaces its error inside the editor overlay (page error UI is unmounted while editing)", async () => {
    await renderInReview();
    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));

    apiMock.mockImplementation(async (path: string) => {
      if (path === "/images/rotate") throw new Error("rotate exploded");
      return {};
    });
    fireEvent.click(screen.getByRole("button", { name: /rotate/i }));

    expect(await screen.findByText("rotate exploded")).toBeInTheDocument();
    // Still inside the editor — the error rendered within the overlay.
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
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

  it("blocks Save (with a reason) until required fields are complete — here, category", async () => {
    scanAspectsState.resolvedCategoryId = null; // category required + incomplete
    scanAspectsState.resolvedCategoryName = null;

    await renderInReview();

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("names the incomplete required field(s) blocking Save", async () => {
    scanAspectsState.resolvedCategoryId = null;
    scanAspectsState.resolvedCategoryName = null;

    await renderInReview();

    expect(screen.getByText(/Complete required field/)).toHaveTextContent(/Category/);
  });

  it("plain Save persists the entered price to the item (same as Save & List)", async () => {
    await renderInReview();

    fireEvent.change(screen.getByLabelText("Price (USD)"), { target: { value: "65" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const itemsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/items");
      expect(call).toBeDefined();
      return call;
    });
    expect((itemsCall?.[1] as { body: { price?: number } }).body.price).toBe(65);
  });

  it("review captures quantity and Save persists it to the item (editable from default 1)", async () => {
    await renderInReview();

    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const itemsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/items");
      expect(call).toBeDefined();
      return call;
    });
    expect((itemsCall?.[1] as { body: { quantity?: number } }).body.quantity).toBe(3);
  });

  it("review captures lb+oz weight and Save persists seller-confirmed weightOz", async () => {
    await renderInReview();

    fireEvent.change(screen.getByLabelText("Pounds"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Ounces"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const itemsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/items");
      expect(call).toBeDefined();
      return call;
    });
    const body = (itemsCall?.[1] as { body: { weightOz?: number; weightEstimated?: boolean } }).body;
    expect(body.weightOz).toBe(24);
    expect(body.weightEstimated).toBe(false);
  });

  it("eBay taxonomy is THE category: free-text input gone, search re-resolves, Save persists the eBay name", async () => {
    await renderInReview();

    // the deprecated internal free-text category input is gone
    // (it used to render with the candidate's category as its value)
    expect(screen.queryByDisplayValue("Guitars")).not.toBeInTheDocument();

    // searching re-resolves against eBay's full taxonomy
    fireEvent.change(screen.getByLabelText("Search eBay category"), {
      target: { value: "studio microphones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find category" }));
    expect(scanAspectsState.resolveCategory).toHaveBeenCalledWith("studio microphones");

    // Save persists the resolved eBay category name as the item's category
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const itemsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/items");
      expect(call).toBeDefined();
      return call;
    });
    const body = (itemsCall?.[1] as { body: { category?: string; marketplaceData?: { ebay?: { categoryId?: string } } } }).body;
    expect(body.category).toBe("Electric Guitars");
    // ...and the resolved LEAF id is cached on the item so publish can resolve
    // the category instead of falling back to a title guess.
    expect(body.marketplaceData?.ebay?.categoryId).toBe("33034");
  });

  it("seeds Brand/Model aspects from the item fields (deterministic copy, not AI)", async () => {
    scanAspectsState.aspects = {
      Brand: { required: true, values: null },
      Model: { required: false, values: null },
    };
    scanAspectsState.aspectValues = {};

    await renderInReview();

    expect(scanAspectsState.setAspectValue).toHaveBeenCalledWith("Brand", "Fender");
    expect(scanAspectsState.setAspectValue).toHaveBeenCalledWith("Model", "Stratocaster");
  });

  it("never re-seeds an aspect the seller explicitly cleared or already set", async () => {
    scanAspectsState.aspects = {
      Brand: { required: true, values: null },
      Model: { required: false, values: null },
    };
    // Brand cleared by the seller (empty string under the key); Model set by hand.
    scanAspectsState.aspectValues = { Brand: "", Model: "Custom Shop" };

    await renderInReview();

    expect(scanAspectsState.setAspectValue).not.toHaveBeenCalledWith("Brand", expect.anything());
    expect(scanAspectsState.setAspectValue).not.toHaveBeenCalledWith("Model", expect.anything());
  });

  it("Save & List persists the lb+oz weight to the item (duplicated payload path)", async () => {
    await renderInReview();

    fireEvent.change(screen.getByLabelText("Pounds"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Ounces"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    const itemsCall = await vi.waitFor(() => {
      const call = apiMock.mock.calls.find(([path]) => path === "/items");
      expect(call).toBeDefined();
      return call;
    });
    const body = (itemsCall?.[1] as { body: { weightOz?: number; weightEstimated?: boolean } }).body;
    expect(body.weightOz).toBe(24);
    expect(body.weightEstimated).toBe(false);
  });

  it("Save & List with the eBay-draft toggle on opens the confirm sheet seeded as an eBay draft", async () => {
    await renderInReview();
    fireEvent.click(screen.getByLabelText("List as eBay draft"));
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    // F1: scan creates the item, then opens the unified confirm sheet (no direct
    // /listings POST). The eBay-draft choice seeds the sheet's primary action.
    await vi.waitFor(() => expect(apiMock.mock.calls.some(([p]) => p === "/items")).toBe(true));
    expect(await screen.findByText("Create Listing")).toBeInTheDocument();
    expect(screen.getByText("Save eBay Draft")).toBeInTheDocument();
    expect(apiMock.mock.calls.some(([p]) => p === "/listings")).toBe(false);
  });

  it("Save & List creates the item then opens the confirm sheet seeded live from the seller profile", async () => {
    await renderInReview();
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    await vi.waitFor(() => expect(apiMock.mock.calls.some(([p]) => p === "/items")).toBe(true));
    // Profile = live → the sheet seeds publish-now on, so its primary action
    // reviews terms before publishing (not a Portage-local draft).
    expect(await screen.findByText("Create Listing")).toBeInTheDocument();
    expect(screen.getByText("Review Terms")).toBeInTheDocument();
    expect(apiMock.mock.calls.some(([p]) => p === "/listings")).toBe(false);
  });

  it("review shipping fields ride into the confirm sheet as a touched seed", async () => {
    await renderInReview();

    // Set shipping on the REVIEW screen (the ride-along section).
    fireEvent.change(screen.getByLabelText(/shipping method/i), { target: { value: "flat" } });
    fireEvent.change(screen.getByLabelText(/buyer pays/i), { target: { value: "8.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    await vi.waitFor(() => expect(apiMock.mock.calls.some(([p]) => p === "/items")).toBe(true));
    expect(await screen.findByText("Create Listing")).toBeInTheDocument();
    // Both the review section and the sheet's section are on screen; the sheet's
    // copy must arrive SEEDED with the review choice (calculated = seed lost).
    const selects = screen.getAllByLabelText(/shipping method/i) as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(selects.map((s) => s.value)).toEqual(["flat", "flat"]);
  });

  it("opens the confirm sheet with a price provenance hint (estimate fallback)", async () => {
    await renderInReview();
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    expect(await screen.findByText("Create Listing")).toBeInTheDocument();
    // No seller price + no comps in this fixture → the prefill falls back to the
    // AI estimate, and the sheet labels its provenance.
    expect(screen.getByText("Estimated")).toBeInTheDocument();
  });

  it("defaults the confirm sheet to draft (publish-now off) when the seller-profile fetch fails — no accidental live", async () => {
    await renderInReview();
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/seller-profile") throw new Error("profile service down");
      if (path === "/items") return { id: "item-1" };
      return {};
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & List" }));

    expect(await screen.findByText("Create Listing")).toBeInTheDocument();
    // Conservative: profile unknown → publish-now stays OFF → primary action "Save Draft".
    expect(screen.getByText("Save Draft")).toBeInTheDocument();
  });

  it("constrains condition pills to the category's conditionIds and snaps a disallowed selection", async () => {
    // Category only accepts conditionId 1000 → Portage "new" only. The AI
    // candidate said "good", so the selection must snap to New.
    scanAspectsState.conditionIds = ["1000"];

    await renderInReview();

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Good" })).not.toBeInTheDocument();
    // The snap happens in a useEffect after render — await the re-render
    // instead of asserting synchronously (flaked twice on slow CI runners).
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "New" }).className).toContain("bg-[var(--teal)]"),
    );
  });

  it("shows the resolved eBay category as THE category value", async () => {
    await renderInReview();

    // The resolved eBay leaf name renders as the category itself (not a hint line)
    expect(screen.getByText("Electric Guitars")).toBeInTheDocument();
    // Find is disabled until the seller types a search
    expect(screen.getByRole("button", { name: "Find category" })).toBeDisabled();
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

describe("ScanFlow multi-shot camera session", () => {
  it("stays in the camera across shots (no per-photo close → no iOS re-prompt); Done returns with all photos", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: { url: "http://img/1.jpg", key: "k1", width: 100, height: 100 } }),
    }) as unknown as typeof fetch;

    render(<ScanFlow onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Take Photo"));
    expect(screen.getByTestId("camera-open")).toBeInTheDocument();

    await act(async () => {
      camHolder.props!.onCapture(new File(["a"], "1.jpg", { type: "image/jpeg" }));
    });
    await act(async () => {
      camHolder.props!.onCapture(new File(["b"], "2.jpg", { type: "image/jpeg" }));
    });

    // The camera never unmounted between shots.
    expect(screen.getByTestId("camera-open")).toBeInTheDocument();

    await act(async () => {
      camHolder.props!.onClose();
    });
    expect(await screen.findByText(/Scan 2 Photos with Porter/)).toBeInTheDocument();
  });
});
