import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { nextGtcRenewal } from "@/lib/gtc";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t", isAuthenticated: true }) }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "l1" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args), ApiError: class extends Error {} }));

import ListingDetailPage from "./page";

const PUBLISHED_AT = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

const LISTING = {
  id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay",
  marketplaceListingId: "307000000009", status: "active",
  price: 25, currency: "USD",
  createdAt: PUBLISHED_AT, updatedAt: PUBLISHED_AT, publishedAt: PUBLISHED_AT, soldAt: null,
};

const ITEM = { id: "i1", title: "Mic", description: "", photos: [], category: "", condition: "good", quantity: 1 };

function mockApi(gtcAutoEnd: boolean) {
  apiMock.mockImplementation(async (path: string) => {
    if (path === "/listings/l1") return LISTING;
    if (path === "/items/i1") return ITEM;
    if (path === "/seller-profile") return { profile: { gtcAutoEnd } };
    return {};
  });
}

async function renderPage() {
  await act(async () => {
    render(<ListingDetailPage />);
  });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => apiMock.mockReset());

describe("Listing detail GTC date", () => {
  it("shows the auto-end date when the seller has GTC auto-end on", async () => {
    mockApi(true);
    await renderPage();

    const renewal = nextGtcRenewal(new Date(PUBLISHED_AT));
    const autoEnd = new Date(renewal.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(await screen.findByText("Auto-ends")).toBeInTheDocument();
    expect(screen.getByText(autoEnd.toLocaleDateString())).toBeInTheDocument();
  });

  it("shows the GTC renewal date when auto-end is off", async () => {
    mockApi(false);
    await renderPage();

    const renewal = nextGtcRenewal(new Date(PUBLISHED_AT));
    expect(await screen.findByText("GTC renews")).toBeInTheDocument();
    expect(screen.getByText(renewal.toLocaleDateString())).toBeInTheDocument();
    expect(screen.queryByText("Auto-ends")).not.toBeInTheDocument();
  });
});
