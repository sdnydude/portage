import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import InventoryPage from "./page";

const h = vi.hoisted(() => ({
  items: [
    { id: "i1", title: "Strat", photos: [], condition: "good", category: "Guitars", listed: false },
    { id: "i2", title: "Tele", photos: [], condition: "good", category: "Guitars", listed: false },
  ],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/inventory",
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
}));
vi.mock("@/hooks/use-messages", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));
const useItemsMock = vi.fn(() => ({
  items: h.items,
  total: 2,
  isLoading: false,
  error: null as string | null,
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-items", () => ({
  useItems: () => useItemsMock(),
}));
vi.mock("@/hooks/use-export", () => ({
  useExport: () => ({ exportItems: vi.fn(), isExporting: false }),
}));
vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue({}),
  ApiError: class extends Error {},
}));
vi.mock("@/components/porter/ask-porter-bar", () => ({
  AskPorterBar: () => <div data-testid="ask-porter-stub" />,
}));
vi.mock("@/components/inventory/item-detail", () => ({
  ItemDetail: ({ itemId }: { itemId: string }) => (
    <div data-testid="item-detail-stub">{itemId}</div>
  ),
}));

describe("Inventory workbench (lg master-detail)", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("shows the empty hint, then renders the detail pane for a clicked item", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText(/select an item/i)).toBeInTheDocument();
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i1");
  });

  it("moves selection with ArrowDown on the list pane", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    fireEvent.keyDown(within(workbench).getByLabelText(/arrow keys/i), { key: "ArrowDown" });
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i2");
  });

  it("scrolls the selected card into view when the selection changes", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("selects the item from the ?item= deep link on mount", () => {
    window.history.replaceState(null, "", "/inventory?item=i2");
    render(<InventoryPage />);
    expect(
      within(screen.getByTestId("workbench")).getByTestId("item-detail-stub"),
    ).toHaveTextContent("i2");
  });

  it("ignores the ?item= deep link below the lg breakpoint — the hidden pane must not fetch (P3 14efa906)", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true, writable: true,
      value: vi.fn((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    try {
      window.history.replaceState(null, "", "/inventory?item=i2");
      render(<InventoryPage />);
      expect(screen.queryByTestId("item-detail-stub")).not.toBeInTheDocument();
      expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 1024px)");
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
    }
  });

  it("honors the ?item= deep link at the lg breakpoint (matchMedia matches)", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true, writable: true,
      value: vi.fn((q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    try {
      window.history.replaceState(null, "", "/inventory?item=i2");
      render(<InventoryPage />);
      expect(within(screen.getByTestId("workbench")).getByTestId("item-detail-stub")).toHaveTextContent("i2");
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
    }
  });

  it("with no matchMedia at all (non-browser), the deep link fails open to the desktop pane", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined });
    try {
      window.history.replaceState(null, "", "/inventory?item=i2");
      render(<InventoryPage />);
      expect(within(screen.getByTestId("workbench")).getByTestId("item-detail-stub")).toHaveTextContent("i2");
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
    }
  });

  it("updates the URL via history.replaceState when an item is selected", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(window.location.search).toBe("?item=i1");
  });

  it("shows the item count and a Select toggle in the list pane header", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText("2 items")).toBeInTheDocument();
    expect(within(workbench).getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("shows an Export control in the list pane header", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByRole("button", { name: /export inventory/i })).toBeInTheDocument();
  });

  it("shows the search bar and view controls in the list pane", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByPlaceholderText("Search items...")).toBeInTheDocument();
    expect(within(workbench).getByRole("button", { name: "All" })).toBeInTheDocument();
  });

  it("shows a loading spinner in the list pane while items are loading", () => {
    useItemsMock.mockReturnValueOnce({ items: [], total: 0, isLoading: true, error: null, refetch: vi.fn() });
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByTestId("list-pane-loading")).toBeInTheDocument();
  });

  it("shows the empty-state hint in the list pane when there are no items", () => {
    useItemsMock.mockReturnValueOnce({ items: [], total: 0, isLoading: false, error: null, refetch: vi.fn() });
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText(/no items yet/i)).toBeInTheDocument();
  });

  it("shows the error message in the list pane when the fetch fails", () => {
    useItemsMock.mockReturnValueOnce({ items: [], total: 0, isLoading: false, error: "Network error", refetch: vi.fn() });
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText("Network error")).toBeInTheDocument();
  });

  it("hides the Export and Select controls in the list pane when inventory is empty", () => {
    useItemsMock.mockReturnValueOnce({ items: [], total: 0, isLoading: false, error: null, refetch: vi.fn() });
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).queryByRole("button", { name: /export inventory/i })).not.toBeInTheDocument();
    expect(within(workbench).queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  });

  // Select mode must not nest a link-mode ItemCard inside the selection
  // toggle button — the nested Link completes a navigation to /inventory/<id>
  // after the toggle fires, swapping the workbench out (registry 334daef2).
  it("renders select-mode cards with no nested link inside the toggle button", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: "Select" }));
    expect(within(workbench).getByRole("button", { name: /select strat/i })).toBeInTheDocument();
    expect(within(workbench).queryByRole("link")).not.toBeInTheDocument();
  });

  // In select mode both trees render [data-item-id] (non-interactive cards),
  // and an unscoped document.querySelector hits the hidden mobile copy —
  // scrollIntoView no-ops (fix3 F9). The scrolled node must be the pane copy.
  it("scrolls the pane copy of the selected card, not the hidden mobile copy", () => {
    const spy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: "Select" }));
    fireEvent.keyDown(within(workbench).getByLabelText(/arrow keys/i), { key: "ArrowDown" });
    expect(spy).toHaveBeenCalled();
    const target = spy.mock.contexts.at(-1) as Node;
    expect(workbench.contains(target)).toBe(true);
  });

  // Bulk-deleting the item that is open in the detail pane must clear the
  // selection — otherwise the pane keeps rendering the deleted item's stale
  // cache and edits PATCH a deleted row (fix3 F2).
  it("clears the detail pane and URL when bulk delete removes the selected item", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i1");
    fireEvent.click(within(workbench).getByRole("button", { name: "Select" }));
    fireEvent.click(within(workbench).getByRole("button", { name: /select strat/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete 1 item/i }));
    await waitFor(() =>
      expect(within(workbench).getByText(/select an item/i)).toBeInTheDocument(),
    );
    expect(window.location.search).toBe("");
    confirmSpy.mockRestore();
  });

  // F15b: nested-Link regression guard for the MOBILE tree — select mode must
  // render zero links anywhere (both trees share ItemsGrid; a link-mode card
  // inside the toggle navigates after the toggle fires, registry 334daef2).
  it("renders no links anywhere in select mode, mobile tree included", () => {
    render(<InventoryPage />);
    fireEvent.click(
      within(screen.getByTestId("workbench")).getByRole("button", { name: "Select" }),
    );
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  // The 380px list pane must not inherit the mobile tree's viewport-scoped
  // column classes — xl:grid-cols-4 in the pane collapses card titles to
  // zero width (caught live by e2e/workbench.spec.ts).
  it("keeps the pane grid at two columns instead of viewport-scoped md/xl columns", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    const grid = within(workbench).getByRole("button", { name: /strat/i }).parentElement!;
    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).not.toMatch(/(?:md|xl):grid-cols/);
  });
});
