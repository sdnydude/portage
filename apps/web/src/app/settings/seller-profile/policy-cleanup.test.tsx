import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SellerProfilePage from "./page";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: apiMock }));

const PROFILE = {
  id: "sp-1",
  userId: "u-1",
  ebayFulfillmentPolicyId: null,
  ebayPaymentPolicyId: null,
  ebayReturnPolicyId: null,
  ebayMerchantLocationKey: null,
  ebayPublishMode: "live",
  reverbOffersEnabled: true,
  reverbDefaultShipping: null,
  shipFromAddress: null,
  defaultWeightUnit: "oz",
  defaultDimensionUnit: "in",
  defaultPackageType: "box",
  preferredMarketplaces: ["ebay"],
  autoPublish: false,
  defaultCurrency: "USD",
  pricingSuggestPercentile: 50,
  pricingFloorPercentile: 25,
  bestOfferAutoAcceptEnabled: false,
  gtcAutoEnd: false,
  defaultListingFooter: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.mockImplementation(async (path: string) => {
    if (path === "/seller-profile") return { profile: PROFILE };
    if (path === "/users/me/marketplace-accounts") return { accounts: [] };
    return {};
  });
});

describe("SellerProfilePage — Business Policies cleanup (Trade-First inline terms)", () => {
  it("renders NO policy dropdowns, merchant-location field, or setup button", async () => {
    render(<SellerProfilePage />);
    // Wait for the profile to load (publish-mode select is a stable landmark).
    await screen.findByText("Default Publish Mode");

    // Trade-First publishes with inline terms — the Business Policies era UI
    // (dropdowns + one-click setup that now only 400s) must be gone.
    expect(screen.queryByText("Fulfillment Policy")).toBeNull();
    expect(screen.queryByText("Payment Policy")).toBeNull();
    expect(screen.queryByText("Return Policy")).toBeNull();
    expect(screen.queryByText("Merchant Location Key")).toBeNull();
    expect(screen.queryByText(/Set up eBay Selling/i)).toBeNull();
    expect(screen.queryByText(/Re-run setup/i)).toBeNull();
  });

  it("saves the ship-from address explicitly (it used to save only via the setup button)", async () => {
    render(<SellerProfilePage />);
    await screen.findByText("Default Publish Mode");

    fireEvent.change(screen.getByPlaceholderText("ZIP"), { target: { value: "12550" } });
    apiMock.mockClear();
    apiMock.mockResolvedValue({ profile: { ...PROFILE, shipFromAddress: { zip: "12550", country: "US" } } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/seller-profile", expect.objectContaining({
        method: "PATCH",
        body: { shipFromAddress: expect.objectContaining({ zip: "12550", country: "US" }) },
      }));
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("refuses to save without a ZIP — the whole point of the address is the origin ZIP", async () => {
    render(<SellerProfilePage />);
    await screen.findByText("Default Publish Mode");

    apiMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));

    expect(await screen.findByText("ZIP is required — eBay computes buyer shipping from it")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("never fetches the removed /seller-profile/ebay-policies endpoint", async () => {
    render(<SellerProfilePage />);
    await screen.findByText("Default Publish Mode");

    const paths = apiMock.mock.calls.map(c => c[0]);
    expect(paths).not.toContain("/seller-profile/ebay-policies");
  });
});
