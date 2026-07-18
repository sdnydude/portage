import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import ListingsPage from "./page";

const h = vi.hoisted(() => ({
  listings: [
    {
      id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
      marketplaceListingId: "3001", marketplaceSpecificFields: null,
      status: "active", price: 100, currency: "USD",
      createdAt: "2026-07-01T00:00:00Z", publishedAt: "2026-07-01T00:00:00Z", soldAt: null,
      itemTitle: "Strat",
    },
    {
      id: "l2", itemId: "i2", userId: "u1", marketplace: "ebay",
      marketplaceListingId: "3002", marketplaceSpecificFields: null,
      status: "active", price: 200, currency: "USD",
      createdAt: "2026-07-02T00:00:00Z", publishedAt: "2026-07-02T00:00:00Z", soldAt: null,
      itemTitle: "Tele",
    },
  ],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/listings",
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
}));
vi.mock("@/hooks/use-messages", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));
const useListingsMock = vi.fn(() => ({
  listings: h.listings,
  isLoading: false,
  error: null as string | null,
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-listings", () => ({
  useListings: () => useListingsMock(),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn(), ApiError: class extends Error {} }));
vi.mock("@/components/porter/ask-porter-bar", () => ({
  AskPorterBar: () => <div data-testid="ask-porter-stub" />,
}));
vi.mock("@/components/inventory/item-detail", () => ({
  ItemDetail: ({ itemId, focusListingId }: { itemId: string; focusListingId?: string | null }) => (
    <div data-testid="item-detail-stub">{itemId}:{focusListingId}</div>
  ),
}));

describe("Listings workbench (lg master-detail)", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens the listing's item in the pane with the listing focused", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i1:l1");
  });

  it("moves selection with ArrowDown on the list pane", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    fireEvent.keyDown(within(workbench).getByLabelText(/arrow keys/i), { key: "ArrowDown" });
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i2:l2");
  });

  it("moves selection back up with ArrowUp on the list pane", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /tele/i }));
    fireEvent.keyDown(within(workbench).getByLabelText(/arrow keys/i), { key: "ArrowUp" });
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i1:l1");
  });

  it("scrolls the selected card into view when the selection changes", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("selects the listing from the ?listing= deep link on mount", () => {
    window.history.replaceState(null, "", "/listings?listing=l2");
    render(<ListingsPage />);
    expect(
      within(screen.getByTestId("workbench")).getByTestId("item-detail-stub"),
    ).toHaveTextContent("i2:l2");
  });

  // F8: an unknown/deleted/filtered-out ?listing= id used to render the
  // generic "Select a listing" hint — a silent miss (fix3 F8).
  it("shows a not-found state for an unknown ?listing= deep link", () => {
    window.history.replaceState(null, "", "/listings?listing=nope");
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText(/listing not found/i)).toBeInTheDocument();
    fireEvent.click(within(workbench).getByRole("button", { name: /clear selection/i }));
    expect(within(workbench).getByText(/select a listing/i)).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("updates the URL via history.replaceState when a listing is selected", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(window.location.search).toBe("?listing=l1");
  });

  it("shows the listing count and a Select toggle in the list pane header", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText("2 listings")).toBeInTheDocument();
    expect(within(workbench).getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("shows the status filter pills in the list pane", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(within(workbench).getByRole("button", { name: "Active" })).toBeInTheDocument();
  });

  it("shows a loading spinner in the list pane while listings are loading", () => {
    useListingsMock.mockReturnValueOnce({ listings: [], isLoading: true, error: null, refetch: vi.fn() });
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByTestId("list-pane-loading")).toBeInTheDocument();
  });

  it("shows the empty-state hint in the list pane when there are no listings", () => {
    useListingsMock.mockReturnValueOnce({ listings: [], isLoading: false, error: null, refetch: vi.fn() });
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText(/no listings yet/i)).toBeInTheDocument();
  });

  it("shows the error message in the list pane when the fetch fails", () => {
    useListingsMock.mockReturnValueOnce({ listings: [], isLoading: false, error: "Network error", refetch: vi.fn() });
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText("Network error")).toBeInTheDocument();
  });

  // Mirror of the inventory F2 fix: bulk-deleting the listing open in the
  // pane must clear the selection and strip ?listing= from the URL.
  it("clears the detail pane and URL when bulk delete removes the selected listing", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i1:l1");
    fireEvent.click(within(workbench).getByRole("button", { name: "Select" }));
    fireEvent.click(within(workbench).getByRole("button", { name: /select listing for \$100/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete 1 listing/i }));
    await waitFor(() =>
      expect(within(workbench).getByText(/select a listing/i)).toBeInTheDocument(),
    );
    expect(window.location.search).toBe("");
    confirmSpy.mockRestore();
  });

  it("hides the Select control in the list pane when there are no listings", () => {
    useListingsMock.mockReturnValueOnce({ listings: [], isLoading: false, error: null, refetch: vi.fn() });
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  });
});
