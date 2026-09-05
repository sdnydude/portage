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
    if (path === "/marketplace/reverb/shipping-profiles") {
      return { profiles: [{ id: "456", name: "Pedals + small gear" }, { id: "789", name: "Heavy amps" }] };
    }
    return {};
  });
});

// Reverb blocks publish without shipping ("Please set a shipping rate or
// enable local pickup." — live 2026-07-21). Reverb's recommended setup is a
// Reverb-side shipping profile referenced by id; this section is the only
// place in Portage to pick one.
describe("Seller profile Reverb shipping defaults", () => {
  it("saves the selected Reverb shipping profile id as reverbDefaultShipping", async () => {
    render(<SellerProfilePage />);

    const select = await screen.findByLabelText(/reverb shipping profile/i);
    // Options load async from /marketplace/reverb/shipping-profiles — changing
    // a controlled select to a value with no matching option silently no-ops.
    await screen.findByRole("option", { name: "Pedals + small gear" });
    fireEvent.change(select, { target: { value: "456" } });
    fireEvent.click(screen.getByRole("button", { name: /save shipping/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/seller-profile", expect.objectContaining({
        method: "PATCH",
        body: {
          reverbDefaultShipping: { shippingProfileId: "456", local: false },
        },
      }));
    });
  });
});
