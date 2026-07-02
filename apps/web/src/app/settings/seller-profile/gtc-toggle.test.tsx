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
    if (path === "/seller-profile/ebay-policies") return { fulfillment: [], payment: [], returnPolicy: [] };
    if (path === "/users/me/marketplace-accounts") return { accounts: [] };
    return {};
  });
});

describe("Seller profile GTC auto-end toggle", () => {
  it("renders unchecked from the stored profile and PATCHes gtcAutoEnd on toggle", async () => {
    render(<SellerProfilePage />);

    const toggle = await screen.findByLabelText(/gtc/i);
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/seller-profile", expect.objectContaining({
        method: "PATCH",
        body: { gtcAutoEnd: true },
      }));
    });
  });
});
