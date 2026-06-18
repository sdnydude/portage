import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SellerProfilePage from "./page";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
// The page now has a back-to-inventory header that uses useRouter.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: apiMock }));

const PROFILE = {
  id: "sp-1",
  userId: "u-1",
  ebayFulfillmentPolicyId: "fp-1",
  ebayPaymentPolicyId: "pp-1",
  ebayReturnPolicyId: "rp-1",
  ebayMerchantLocationKey: "loc-1",
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
  defaultListingFooter: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.mockImplementation(async (path: string) => {
    if (path === "/seller-profile") return { profile: PROFILE };
    if (path === "/seller-profile/ebay-policies") return { fulfillment: [], payment: [], returnPolicy: [] };
    if (path === "/users/me/marketplace-accounts") return { accounts: [] };
    return {};
  });
});

describe("Seller profile Pricing section", () => {
  it("renders the pricing tunables with stored values and PATCHes a percentile change on blur", async () => {
    render(<SellerProfilePage />);

    const suggestInput = await screen.findByLabelText(/suggested-price percentile/i);
    expect(suggestInput).toHaveValue(50);
    expect(screen.getByLabelText(/auto-accept floor percentile/i)).toHaveValue(25);
    expect(screen.getByLabelText(/best offer/i)).not.toBeChecked();
    expect(screen.getByLabelText(/default listing footer/i)).toHaveValue("");

    fireEvent.change(suggestInput, { target: { value: "75" } });
    fireEvent.blur(suggestInput);

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/seller-profile", expect.objectContaining({
        method: "PATCH",
        body: { pricingSuggestPercentile: 75 },
      }));
    });
  });

  it("reverts an out-of-range percentile on blur instead of silently keeping it on screen", async () => {
    render(<SellerProfilePage />);

    const suggestInput = await screen.findByLabelText(/suggested-price percentile/i);
    fireEvent.change(suggestInput, { target: { value: "95" } });
    fireEvent.blur(suggestInput);

    // No save fired, and the field shows the stored value again — never an
    // unsaved value masquerading as saved.
    expect(apiMock).not.toHaveBeenCalledWith("/seller-profile", expect.objectContaining({ method: "PATCH" }));
    expect(suggestInput).toHaveValue(50);
  });

  it("reverts an out-of-range floor percentile on blur too", async () => {
    render(<SellerProfilePage />);

    const floorInput = await screen.findByLabelText(/auto-accept floor percentile/i);
    fireEvent.change(floorInput, { target: { value: "95" } });
    fireEvent.blur(floorInput);

    expect(apiMock).not.toHaveBeenCalledWith("/seller-profile", expect.objectContaining({ method: "PATCH" }));
    expect(floorInput).toHaveValue(25);
  });

  it("surfaces the server's actionable error message instead of a generic 'Failed to save'", async () => {
    render(<SellerProfilePage />);

    const floorInput = await screen.findByLabelText(/auto-accept floor percentile/i);
    // 60 passes the client range (5–75) but violates floor < stored suggest (50)
    // server-side — the server's PRICING_FLOOR_INVALID message must reach the user.
    apiMock.mockRejectedValueOnce(new Error("Floor percentile must be below the suggested-price percentile."));
    fireEvent.change(floorInput, { target: { value: "60" } });
    fireEvent.blur(floorInput);

    expect(await screen.findByText(/floor percentile must be below/i)).toBeInTheDocument();
  });
});
