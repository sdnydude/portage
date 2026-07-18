import { describe, it, expect } from "vitest";
import { buildListingPayload, type ScanListingInput } from "./scan-listing-payload";

const baseInput: ScanListingInput = {
  itemId: "item-1",
  price: 49.99,
  resolvedCategoryId: "33034",
  aspects: { Brand: ["Fender"] },
};

describe("buildListingPayload", () => {
  it("defaults to draft publishMode when the seller profile is null — confirmed fields still attached", () => {
    expect(buildListingPayload(baseInput, null)).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "draft",
      marketplaceSpecificFields: {
        categoryId: "33034",
        aspects: { Brand: ["Fender"] },
      },
    });
  });

  it("ebayDraft input forces publishMode 'ebay_draft' (overrides the profile default)", () => {
    expect(
      buildListingPayload({ ...baseInput, ebayDraft: true }, { ebayPublishMode: "live" }).publishMode,
    ).toBe("ebay_draft");
  });

  it("live mode carries categoryId and aspects in marketplaceSpecificFields", () => {
    expect(buildListingPayload(baseInput, { ebayPublishMode: "live" })).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "live",
      marketplaceSpecificFields: {
        categoryId: "33034",
        aspects: { Brand: ["Fender"] },
      },
    });
  });

  it("live with unresolved category carries aspects only — no categoryId key", () => {
    expect(
      buildListingPayload(
        { ...baseInput, resolvedCategoryId: null },
        { ebayPublishMode: "live" },
      ),
    ).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "live",
      marketplaceSpecificFields: { aspects: { Brand: ["Fender"] } },
    });
  });

  it("drops aspect entries whose values are empty or whitespace-only strings", () => {
    expect(
      buildListingPayload(
        {
          ...baseInput,
          aspects: { Brand: ["Fender"], Color: ["", "   "], Type: [] },
        },
        { ebayPublishMode: "live" },
      ),
    ).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "live",
      marketplaceSpecificFields: {
        categoryId: "33034",
        aspects: { Brand: ["Fender"] },
      },
    });
  });

  it("draft mode carries categoryId and aspects too — the draft row persists them so publish doesn't re-ask", () => {
    expect(buildListingPayload(baseInput, { ebayPublishMode: "draft" })).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "draft",
      marketplaceSpecificFields: {
        categoryId: "33034",
        aspects: { Brand: ["Fender"] },
      },
    });
  });

  it("omits marketplaceSpecificFields entirely when there is no category and no usable aspects", () => {
    const payload = buildListingPayload(
      { ...baseInput, resolvedCategoryId: null, aspects: {} },
      { ebayPublishMode: "draft" },
    );
    expect("marketplaceSpecificFields" in payload).toBe(false);
  });

  it("omits price when null", () => {
    expect(buildListingPayload({ ...baseInput, price: null }, null)).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      publishMode: "draft",
      marketplaceSpecificFields: {
        categoryId: "33034",
        aspects: { Brand: ["Fender"] },
      },
    });
  });
});
