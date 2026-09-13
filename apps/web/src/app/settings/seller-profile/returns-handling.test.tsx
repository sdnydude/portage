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
  ebayReturnsAccepted: false,
  ebayReturnDays: 30,
  ebayHandlingDays: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.mockImplementation(async (path: string, options?: { method?: string; body?: unknown; token?: string }) => {
    void options; // mirrors the real api() signature; unused here — assertions read apiMock.mock.calls directly
    if (path === "/seller-profile") return { profile: PROFILE };
    if (path === "/users/me/marketplace-accounts") return { accounts: [] };
    return {};
  });
});

describe("Seller profile returns & handling settings (gap 3)", () => {
  it("PATCHes ebayReturnsAccepted, ebayReturnDays and ebayHandlingDays as each control changes", async () => {
    render(<SellerProfilePage />);

    const toggle = await screen.findByLabelText(/returns accepted/i);
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/seller-profile", expect.objectContaining({
        method: "PATCH",
        body: { ebayReturnsAccepted: true },
      }));
    });

    fireEvent.change(screen.getByLabelText(/return window/i), { target: { value: "14" } });
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/seller-profile", expect.objectContaining({
        method: "PATCH",
        body: { ebayReturnDays: 14 },
      }));
    });

    fireEvent.change(screen.getByLabelText(/handling time/i), { target: { value: "3" } });
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/seller-profile", expect.objectContaining({
        method: "PATCH",
        body: { ebayHandlingDays: 3 },
      }));
    });
  });
});
