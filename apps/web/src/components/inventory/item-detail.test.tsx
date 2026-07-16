import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  updateItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue({}),
  apiMock: vi.fn(),
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
    item: h.item,
    isLoading: false, error: null, deleteItem: h.deleteItem, updateItem: h.updateItem,
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

import { ItemDetail } from "./item-detail";

// jsdom has no scrollIntoView; the deep-link test installs one. Capture
// whatever is there so every test starts from the same prototype state.
const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
afterEach(() => {
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

  it("calls onDeleted after a confirmed delete", async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={onDeleted} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^delete item$/i }));
    expect(h.deleteItem).toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();
  });
});
