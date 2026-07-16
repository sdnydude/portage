import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
});
