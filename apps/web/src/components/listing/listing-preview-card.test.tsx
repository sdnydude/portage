import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PreparedListingData } from "@portage/shared";

// Mock the schema fetch: "Preamp Type" is required with allowed values.
const mockUseRequiredAspects = vi.fn();
vi.mock("@/hooks/use-required-aspects", () => ({
  useRequiredAspects: () => mockUseRequiredAspects(),
}));
vi.mock("./comps-pricing-widget", () => ({
  CompsPricingWidget: () => <div data-testid="comps" />,
}));

import { ListingPreviewCard } from "./listing-preview-card";

const ebay = {
  title: "Cloud Microphones Cloudlifter CL-1",
  categoryId: "119018",
  categoryName: "Preamps",
  condition: "USED_GOOD",
  conditionDescription: "",
  aspects: { Brand: ["Cloud Microphones"] }, // AI filled Brand, NOT Preamp Type
  upc: null,
  epid: null,
  weight: { value: 8, unit: "oz" },
  dimensions: { length: 4, width: 3, height: 2, unit: "in" },
  packageType: "BOX",
  fulfillmentPolicyId: "fp",
  paymentPolicyId: "pp",
  returnPolicyId: "rp",
  merchantLocationKey: "loc",
};

const data: PreparedListingData = {
  title: "Cloudlifter CL-1",
  description: "Mic activator",
  condition: "good",
  conditionDescription: "",
  brand: "Cloud Microphones",
  model: "CL-1",
  pricing: { suggested: 150, low: 130, high: 170, currency: "USD", confidence: "high", basedOn: 5, conditionMatch: "exact" },
  comps: { ebay: null, reverb: null },
  ebay: ebay as PreparedListingData["ebay"],
  reverb: null,
  isMusicGear: false,
  aiConfidence: 0.9,
  warnings: [],
};

const baseProps = {
  data,
  photos: [{ url: "https://x/p.jpg", key: "k" }],
  quantity: 1,
  onFieldChange: () => {},
  onPriceChange: () => {},
  onQuantityChange: () => {},
  isPublishing: false,
  sellerProfileComplete: true,
};

describe("ListingPreviewCard — photo gallery strip + editor overlay (S2.5-8)", () => {
  beforeEach(() => {
    mockUseRequiredAspects.mockReturnValue({ aspects: {}, isLoading: false });
  });

  it("renders the gallery strip when onPhotoUpdated is provided; tapping a thumb opens the editor with all 4 tools", () => {
    render(
      <ListingPreviewCard
        {...baseProps}
        onPublish={() => {}}
        onPhotoUpdated={() => {}}
      />,
    );

    expect(screen.getByText(/photos · 1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit photo 1/i }));
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^crop$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bg remove/i })).toBeInTheDocument();
  });
});

describe("ListingPreviewCard — listing footer preview", () => {
  beforeEach(() => {
    mockUseRequiredAspects.mockReturnValue({ aspects: {}, isLoading: false });
  });

  it("renders the seller footer display-only with an added-at-publish note", () => {
    render(
      <ListingPreviewCard
        {...baseProps}
        data={{ ...data, listingFooter: "Ships fast from a smoke-free studio." }}
        onPublish={() => {}}
      />,
    );

    expect(screen.getByText("Ships fast from a smoke-free studio.")).toBeInTheDocument();
    expect(screen.getByText(/added at publish/i)).toBeInTheDocument();
  });
});

describe("ListingPreviewCard — required item specifics gating", () => {
  beforeEach(() => {
    mockUseRequiredAspects.mockReturnValue({
      aspects: {
        Brand: { required: true, values: null, cardinality: "SINGLE" },
        "Preamp Type": { required: true, values: ["Tube", "Solid State"], cardinality: "SINGLE" },
      },
      isLoading: false,
    });
  });

  it("blocks eBay live publish until the AI-missed required specific is filled, then publishes with it", () => {
    const onPublish = vi.fn();
    render(<ListingPreviewCard {...baseProps} onPublish={onPublish} />);

    // Brand was AI-filled; Preamp Type is missing → publish blocked.
    const publishBtn = screen.getByRole("button", { name: /Publish to eBay/i });
    expect(publishBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Tube" }));
    expect(publishBtn).toBeEnabled();

    fireEvent.click(publishBtn);
    expect(onPublish).toHaveBeenCalledWith("ebay", "live", {
      Brand: ["Cloud Microphones"],
      "Preamp Type": ["Tube"],
    });
  });
});

describe("ListingPreviewCard — hero tap opens the editor", () => {
  beforeEach(() => {
    mockUseRequiredAspects.mockReturnValue({ aspects: {}, isLoading: false });
  });

  it("tapping the hero photo opens the full-screen editor on the current photo; a visible edit affordance exists", () => {
    render(<ListingPreviewCard {...baseProps} onPublish={() => {}} onPhotoUpdated={() => {}} />);
    expect(screen.getByRole("button", { name: /edit this photo/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("img", { name: /listing/i }));
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
  });

  it("without onPhotoUpdated (no editor host) the hero is not tappable and no affordance shows", () => {
    render(<ListingPreviewCard {...baseProps} onPublish={() => {}} />);
    expect(screen.queryByRole("button", { name: /edit this photo/i })).not.toBeInTheDocument();
  });
});
